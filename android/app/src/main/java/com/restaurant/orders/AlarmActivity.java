package com.restaurant.orders;

import android.app.Activity;
import android.app.KeyguardManager;
import android.content.Context;
import android.content.Intent;
import android.media.AudioAttributes;
import android.media.AudioManager;
import android.media.MediaPlayer;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.util.Log;
import android.view.Gravity;
import android.view.View;
import android.view.WindowManager;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.TextView;

import org.json.JSONArray;
import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Locale;

public class AlarmActivity extends Activity {
    private static final String TAG = "AlarmActivity";
    private static final String SUPA_REST_URL = "https://puwkpflzgnrontluvicn.supabase.co/rest/v1/orders";
    private static final String SUPA_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB1d2twZmx6Z25yb250bHV2aWNuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTEwNDA1ODcsImV4cCI6MjEwNjYxNjU4N30.Xyr6DjK64ZJxC4QadjYXDCaH7r79VjM8PaaLrJ9Cn84";

    private MediaPlayer mediaPlayer;
    private String currentOrderId = null;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        // Set lockscreen bypass flags BEFORE super.onCreate
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
            setShowWhenLocked(true);
            setTurnScreenOn(true);
            KeyguardManager keyguardManager = (KeyguardManager) getSystemService(Context.KEYGUARD_SERVICE);
            if (keyguardManager != null) {
                keyguardManager.requestDismissKeyguard(this, null);
            }
        }

        getWindow().addFlags(
            WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED |
            WindowManager.LayoutParams.FLAG_DISMISS_KEYGUARD |
            WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON |
            WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON |
            WindowManager.LayoutParams.FLAG_ALLOW_LOCK_WHILE_SCREEN_ON
        );

        super.onCreate(savedInstanceState);

        // Force screen wake up using PowerManager
        android.os.PowerManager pm = (android.os.PowerManager) getSystemService(Context.POWER_SERVICE);
        if (pm != null) {
            android.os.PowerManager.WakeLock wl = pm.newWakeLock(
                android.os.PowerManager.FULL_WAKE_LOCK |
                android.os.PowerManager.ACQUIRE_CAUSES_WAKEUP |
                android.os.PowerManager.ON_AFTER_RELEASE,
                "CafeOrders:AlarmWakeLock"
            );
            wl.acquire(10000);
        }

        setContentView(R.layout.activity_alarm);

        Button btnCancel = findViewById(R.id.btnCancel);
        Button btnAccept = findViewById(R.id.btnAccept);

        btnCancel.setOnClickListener(v -> stopAlarmAndCancel());
        btnAccept.setOnClickListener(v -> stopAlarmAndFinish());

        handleIntentData(getIntent());

        playAlarmSound();
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        handleIntentData(intent);
    }

    private void handleIntentData(Intent intent) {
        if (intent == null) return;

        currentOrderId = intent.getStringExtra("orderId");
        String tableNumber = intent.getStringExtra("tableNumber");
        String customerName = intent.getStringExtra("customerName");
        String customerPhone = intent.getStringExtra("customerPhone");
        String itemsJson = intent.getStringExtra("items");
        String subtotalStr = intent.getStringExtra("subtotal");
        String gstStr = intent.getStringExtra("gst");
        String totalStr = intent.getStringExtra("total");
        String notes = intent.getStringExtra("notes");
        String createdAt = intent.getStringExtra("createdAt");

        TextView tvTableBadge = findViewById(R.id.tvTableBadge);
        TextView tvCustomerDetail = findViewById(R.id.tvCustomerDetail);
        TextView tvOrderTime = findViewById(R.id.tvOrderTime);
        TextView tvSubtotal = findViewById(R.id.tvSubtotal);
        TextView tvGst = findViewById(R.id.tvGst);
        TextView tvGrandTotal = findViewById(R.id.tvGrandTotal);
        TextView tvOrderNotes = findViewById(R.id.tvOrderNotes);
        View notesContainer = findViewById(R.id.notesContainer);
        View rowGst = findViewById(R.id.rowGst);
        LinearLayout itemsListLayout = findViewById(R.id.itemsListLayout);

        if (tableNumber != null && !tableNumber.trim().isEmpty()) {
            tvTableBadge.setText("Table #" + tableNumber);
        } else {
            tvTableBadge.setText("Takeaway / Online");
        }

        StringBuilder custInfo = new StringBuilder();
        custInfo.append("👤 ").append(customerName != null && !customerName.isEmpty() ? customerName : "Guest");
        if (customerPhone != null && !customerPhone.isEmpty()) {
            custInfo.append(" (").append(customerPhone).append(")");
        }
        tvCustomerDetail.setText(custInfo.toString());

        if (createdAt != null && !createdAt.isEmpty()) {
            try {
                tvOrderTime.setText(createdAt);
            } catch (Exception e) {
                tvOrderTime.setText("Just Now");
            }
        } else {
            String timeNow = new SimpleDateFormat("hh:mm a", Locale.getDefault()).format(new Date());
            tvOrderTime.setText(timeNow);
        }

        if (notes != null && !notes.trim().isEmpty() && !"null".equalsIgnoreCase(notes.trim())) {
            tvOrderNotes.setText(notes);
            notesContainer.setVisibility(View.VISIBLE);
        } else {
            notesContainer.setVisibility(View.GONE);
        }

        double subtotal = parseDoubleSafely(subtotalStr, 0);
        double gst = parseDoubleSafely(gstStr, 0);
        double grandTotal = parseDoubleSafely(totalStr, 0);

        tvSubtotal.setText("₹" + Math.round(subtotal));
        if (gst > 0) {
            tvGst.setText("₹" + Math.round(gst));
            rowGst.setVisibility(View.VISIBLE);
        } else {
            rowGst.setVisibility(View.GONE);
        }
        tvGrandTotal.setText("₹" + Math.round(grandTotal));

        if (itemsJson != null && !itemsJson.trim().isEmpty()) {
            populateItemsList(itemsJson);
        } else if (currentOrderId != null && !currentOrderId.isEmpty()) {
            fetchOrderFromSupabase(currentOrderId);
        }

        startStatusPolling();
    }

    private void populateItemsList(String itemsJsonStr) {
        LinearLayout itemsListLayout = findViewById(R.id.itemsListLayout);
        if (itemsListLayout == null) return;
        itemsListLayout.removeAllViews();

        if (itemsJsonStr == null || itemsJsonStr.trim().isEmpty() || "null".equalsIgnoreCase(itemsJsonStr.trim())) {
            if (currentOrderId != null && !currentOrderId.isEmpty()) {
                fetchOrderFromSupabase(currentOrderId);
            }
            return;
        }

        try {
            String cleanJson = itemsJsonStr.trim();
            // Handle double-encoded or escaped JSON strings
            while (cleanJson.startsWith("\"") && cleanJson.endsWith("\"") && cleanJson.length() > 2) {
                try {
                    cleanJson = new JSONObject("{ \"str\": " + cleanJson + " }").optString("str", cleanJson);
                } catch (Exception e) {
                    cleanJson = cleanJson.substring(1, cleanJson.length() - 1).replace("\\\"", "\"");
                }
            }

            JSONArray itemsArray;
            if (cleanJson.startsWith("[")) {
                itemsArray = new JSONArray(cleanJson);
            } else if (cleanJson.startsWith("{")) {
                JSONObject obj = new JSONObject(cleanJson);
                itemsArray = obj.optJSONArray("items");
                if (itemsArray == null) {
                    itemsArray = new JSONArray();
                    itemsArray.put(obj);
                }
            } else {
                itemsArray = new JSONArray();
            }

            if (itemsArray.length() == 0) {
                if (currentOrderId != null && !currentOrderId.isEmpty()) {
                    fetchOrderFromSupabase(currentOrderId);
                }
                return;
            }

            double calculatedTotal = 0;

            for (int i = 0; i < itemsArray.length(); i++) {
                JSONObject itemObj = itemsArray.optJSONObject(i);
                String name = "Item";
                int qty = 1;
                double rate = 0;

                if (itemObj != null) {
                    name = itemObj.optString("name", itemObj.optString("item_name", itemObj.optString("title", itemObj.optString("itemName", "Item"))));
                    qty = itemObj.optInt("qty", itemObj.optInt("quantity", 1));
                    rate = itemObj.optDouble("price", itemObj.optDouble("rate", itemObj.optDouble("cost", 0)));
                } else {
                    name = itemsArray.optString(i, "Item");
                }

                double lineTotal = rate * qty;
                calculatedTotal += lineTotal;

                LinearLayout rowLayout = new LinearLayout(this);
                rowLayout.setOrientation(LinearLayout.HORIZONTAL);
                rowLayout.setPadding(dpToPx(4), dpToPx(8), dpToPx(4), dpToPx(8));
                
                // Add bottom border separator line
                if (i < itemsArray.length() - 1) {
                    rowLayout.setBackgroundColor(0x0AFFFFFF);
                }

                // Item Name
                TextView tvName = new TextView(this);
                LinearLayout.LayoutParams lpName = new LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 2.2f);
                tvName.setLayoutParams(lpName);
                tvName.setText(name);
                tvName.setTextColor(0xFFFFFFFF);
                tvName.setTextSize(14);
                tvName.setTypeface(null, android.graphics.Typeface.BOLD);

                // Qty
                TextView tvQty = new TextView(this);
                LinearLayout.LayoutParams lpQty = new LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 0.8f);
                tvQty.setLayoutParams(lpQty);
                tvQty.setText(qty + "×");
                tvQty.setTextColor(0xFFFDE047);
                tvQty.setTextSize(14);
                tvQty.setGravity(Gravity.CENTER);
                tvQty.setTypeface(null, android.graphics.Typeface.BOLD);

                // Rate
                TextView tvRate = new TextView(this);
                LinearLayout.LayoutParams lpRate = new LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1.0f);
                tvRate.setLayoutParams(lpRate);
                tvRate.setText("₹" + Math.round(rate));
                tvRate.setTextColor(0xFF9CA3AF);
                tvRate.setTextSize(13);
                tvRate.setGravity(Gravity.END);

                // Line Total Amount
                TextView tvAmount = new TextView(this);
                LinearLayout.LayoutParams lpAmount = new LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1.2f);
                tvAmount.setLayoutParams(lpAmount);
                tvAmount.setText("₹" + Math.round(lineTotal));
                tvAmount.setTextColor(0xFF4ADE80);
                tvAmount.setTextSize(14);
                tvAmount.setTypeface(null, android.graphics.Typeface.BOLD);
                tvAmount.setGravity(Gravity.END);

                rowLayout.addView(tvName);
                rowLayout.addView(tvQty);
                rowLayout.addView(tvRate);
                rowLayout.addView(tvAmount);

                itemsListLayout.addView(rowLayout);
            }

            TextView tvGrandTotal = findViewById(R.id.tvGrandTotal);
            TextView tvSubtotal = findViewById(R.id.tvSubtotal);
            if (tvGrandTotal != null && (tvGrandTotal.getText().toString().equals("₹0") || tvGrandTotal.getText().toString().isEmpty())) {
                tvGrandTotal.setText("₹" + Math.round(calculatedTotal));
                if (tvSubtotal != null) tvSubtotal.setText("₹" + Math.round(calculatedTotal));
            }
        } catch (Exception e) {
            Log.e(TAG, "Error parsing items JSON: " + itemsJsonStr, e);
            if (currentOrderId != null && !currentOrderId.isEmpty()) {
                fetchOrderFromSupabase(currentOrderId);
            }
        }

        if (itemsListLayout.getChildCount() == 0 && currentOrderId != null && !currentOrderId.isEmpty()) {
            fetchOrderFromSupabase(currentOrderId);
        }
    }

    private void fetchOrderFromSupabase(String orderId) {
        new Thread(() -> {
            try {
                URL url = new URL(SUPA_REST_URL + "?id=eq." + orderId + "&select=*");
                HttpURLConnection conn = (HttpURLConnection) url.openConnection();
                conn.setRequestMethod("GET");
                conn.setRequestProperty("apikey", SUPA_KEY);
                conn.setRequestProperty("Authorization", "Bearer " + SUPA_KEY);

                int responseCode = conn.getResponseCode();
                if (responseCode == 200) {
                    BufferedReader in = new BufferedReader(new InputStreamReader(conn.getInputStream()));
                    StringBuilder response = new StringBuilder();
                    String inputLine;
                    while ((inputLine = in.readLine()) != null) {
                        response.append(inputLine);
                    }
                    in.close();

                    JSONArray ordersArr = new JSONArray(response.toString());
                    if (ordersArr.length() > 0) {
                        JSONObject order = ordersArr.getJSONObject(0);

                        // Fix: JSONArray property check on org.json.JSONObject
                        Object itemsObj = order.opt("items");
                        String itemsStr = "[]";
                        if (itemsObj instanceof JSONArray) {
                            itemsStr = ((JSONArray) itemsObj).toString();
                        } else if (itemsObj != null) {
                            itemsStr = itemsObj.toString();
                        }

                        String tableNumber = order.optString("table_number", "");
                        String customerName = order.optString("customer_name", "Guest");
                        String customerPhone = order.optString("customer_phone", "");
                        double total = order.optDouble("total", 0);
                        double subtotal = order.optDouble("subtotal", total);
                        double gst = order.optDouble("gst", 0);
                        String notes = order.optString("notes", "");

                        final String finalItemsStr = itemsStr;

                        runOnUiThread(() -> {
                            TextView tvTableBadge = findViewById(R.id.tvTableBadge);
                            TextView tvCustomerDetail = findViewById(R.id.tvCustomerDetail);
                            TextView tvGrandTotal = findViewById(R.id.tvGrandTotal);
                            TextView tvSubtotal = findViewById(R.id.tvSubtotal);
                            TextView tvGst = findViewById(R.id.tvGst);
                            View rowGst = findViewById(R.id.rowGst);
                            TextView tvOrderNotes = findViewById(R.id.tvOrderNotes);
                            View notesContainer = findViewById(R.id.notesContainer);

                            if (tableNumber != null && !tableNumber.isEmpty()) {
                                tvTableBadge.setText("Table #" + tableNumber);
                            } else {
                                tvTableBadge.setText("Takeaway / Online");
                            }

                            StringBuilder custInfo = new StringBuilder("👤 ");
                            custInfo.append(customerName != null && !customerName.isEmpty() ? customerName : "Guest");
                            if (customerPhone != null && !customerPhone.isEmpty()) {
                                custInfo.append(" (").append(customerPhone).append(")");
                            }
                            tvCustomerDetail.setText(custInfo.toString());

                            tvGrandTotal.setText("₹" + Math.round(total));
                            tvSubtotal.setText("₹" + Math.round(subtotal));

                            if (gst > 0) {
                                tvGst.setText("₹" + Math.round(gst));
                                if (rowGst != null) rowGst.setVisibility(View.VISIBLE);
                            } else {
                                if (rowGst != null) rowGst.setVisibility(View.GONE);
                            }

                            if (!notes.isEmpty() && !"null".equalsIgnoreCase(notes.trim())) {
                                tvOrderNotes.setText(notes);
                                notesContainer.setVisibility(View.VISIBLE);
                            } else {
                                notesContainer.setVisibility(View.GONE);
                            }

                            populateItemsList(finalItemsStr);
                        });
                    }
                }
            } catch (Exception e) {
                Log.e(TAG, "Error fetching order fallback from Supabase", e);
            }
        }).start();
    }

    private void playAlarmSound() {
        try {
            Uri alarmUri = Uri.parse("android.resource://" + getPackageName() + "/" + R.raw.custom_alarm);

            mediaPlayer = new MediaPlayer();
            mediaPlayer.setDataSource(this, alarmUri);

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
                mediaPlayer.setAudioAttributes(new AudioAttributes.Builder()
                        .setUsage(AudioAttributes.USAGE_ALARM)
                        .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                        .build());
            } else {
                mediaPlayer.setAudioStreamType(AudioManager.STREAM_ALARM);
            }

            mediaPlayer.setLooping(true);
            mediaPlayer.prepare();
            mediaPlayer.start();
            Log.d(TAG, "Alarm playing...");
        } catch (Exception e) {
            Log.e(TAG, "Error playing alarm", e);
        }
    }

    private void stopAlarmAndCancel() {
        stopAudio();

        // Update order status in Supabase DB to 'cancelled' asynchronously
        if (currentOrderId != null && !currentOrderId.isEmpty()) {
            new Thread(() -> {
                try {
                    URL url = new URL(SUPA_REST_URL + "?id=eq." + currentOrderId);
                    HttpURLConnection conn = (HttpURLConnection) url.openConnection();
                    conn.setRequestMethod("PATCH");
                    conn.setRequestProperty("Content-Type", "application/json");
                    conn.setRequestProperty("apikey", SUPA_KEY);
                    conn.setRequestProperty("Authorization", "Bearer " + SUPA_KEY);
                    conn.setDoOutput(true);

                    String payload = "{\"status\": \"cancelled\"}";
                    try (OutputStream os = conn.getOutputStream()) {
                        byte[] input = payload.getBytes("utf-8");
                        os.write(input, 0, input.length);
                    }

                    int code = conn.getResponseCode();
                    Log.d(TAG, "Supabase Order Cancel Status Response Code: " + code);
                } catch (Exception e) {
                    Log.e(TAG, "Error updating order status on Cancel", e);
                }
            }).start();
        }

        finish();
    }

    private void stopAlarmAndFinish() {
        stopAudio();

        // Update order status in Supabase DB to 'preparing' asynchronously
        if (currentOrderId != null && !currentOrderId.isEmpty()) {
            new Thread(() -> {
                try {
                    URL url = new URL(SUPA_REST_URL + "?id=eq." + currentOrderId);
                    HttpURLConnection conn = (HttpURLConnection) url.openConnection();
                    conn.setRequestMethod("PATCH");
                    conn.setRequestProperty("Content-Type", "application/json");
                    conn.setRequestProperty("apikey", SUPA_KEY);
                    conn.setRequestProperty("Authorization", "Bearer " + SUPA_KEY);
                    conn.setDoOutput(true);

                    String payload = "{\"status\": \"preparing\"}";
                    try (OutputStream os = conn.getOutputStream()) {
                        byte[] input = payload.getBytes("utf-8");
                        os.write(input, 0, input.length);
                    }

                    int code = conn.getResponseCode();
                    Log.d(TAG, "Supabase Order Accept Status Response Code: " + code);
                } catch (Exception e) {
                    Log.e(TAG, "Error updating order status on Accept", e);
                }
            }).start();
        }

        // Restart main app to open order management page
        Intent intent = new Intent(this, MainActivity.class);
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TASK);
        startActivity(intent);

        finish();
    }

    private void stopAudio() {
        if (mediaPlayer != null) {
            try {
                if (mediaPlayer.isPlaying()) {
                    mediaPlayer.stop();
                }
                mediaPlayer.release();
            } catch (Exception e) {
                Log.e(TAG, "Error stopping audio", e);
            }
            mediaPlayer = null;
        }
    }

    private int dpToPx(int dp) {
        float density = getResources().getDisplayMetrics().density;
        return Math.round(dp * density);
    }

    private double parseDoubleSafely(String val, double defaultVal) {
        if (val == null || val.trim().isEmpty()) return defaultVal;
        try {
            return Double.parseDouble(val.trim());
        } catch (Exception e) {
            return defaultVal;
        }
    }

    private final android.os.Handler statusCheckHandler = new android.os.Handler(android.os.Looper.getMainLooper());
    private Runnable statusCheckRunnable;
    private boolean isActivityDestroyed = false;

    private void startStatusPolling() {
        stopStatusPolling();
        if (currentOrderId == null || currentOrderId.isEmpty()) return;
        statusCheckRunnable = new Runnable() {
            @Override
            public void run() {
                if (isActivityDestroyed || isFinishing()) return;
                checkOrderStatusInSupabase(currentOrderId);
                statusCheckHandler.postDelayed(this, 2500);
            }
        };
        statusCheckHandler.postDelayed(statusCheckRunnable, 2500);
    }

    private void stopStatusPolling() {
        if (statusCheckRunnable != null) {
            statusCheckHandler.removeCallbacks(statusCheckRunnable);
        }
    }

    private void checkOrderStatusInSupabase(String orderId) {
        new Thread(() -> {
            try {
                URL url = new URL(SUPA_REST_URL + "?id=eq." + orderId + "&select=status");
                HttpURLConnection conn = (HttpURLConnection) url.openConnection();
                conn.setRequestMethod("GET");
                conn.setRequestProperty("apikey", SUPA_KEY);
                conn.setRequestProperty("Authorization", "Bearer " + SUPA_KEY);

                int responseCode = conn.getResponseCode();
                if (responseCode == 200) {
                    BufferedReader in = new BufferedReader(new InputStreamReader(conn.getInputStream()));
                    StringBuilder response = new StringBuilder();
                    String inputLine;
                    while ((inputLine = in.readLine()) != null) {
                        response.append(inputLine);
                    }
                    in.close();

                    JSONArray ordersArr = new JSONArray(response.toString());
                    if (ordersArr.length() > 0) {
                        JSONObject order = ordersArr.getJSONObject(0);
                        String status = order.optString("status", "pending");

                        if (!"pending".equalsIgnoreCase(status)) {
                            Log.d(TAG, "Order " + orderId + " handled on another device (status: " + status + "). Auto-dismissing alarm.");
                            runOnUiThread(() -> {
                                stopAudio();
                                finish();
                            });
                        }
                    }
                }
            } catch (Exception e) {
                Log.e(TAG, "Error checking order status polling", e);
            }
        }).start();
    }

    @Override
    protected void onDestroy() {
        isActivityDestroyed = true;
        stopStatusPolling();
        stopAudio();
        super.onDestroy();
    }
}
