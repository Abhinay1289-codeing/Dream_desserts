package com.dreamdesserts.app;

import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.util.Log;
import android.provider.Settings;
import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;
import com.capacitorjs.plugins.pushnotifications.MessagingService;
import com.google.firebase.messaging.RemoteMessage;

public class MyFirebaseMessagingService extends MessagingService {
    
    @Override
    public void onMessageReceived(RemoteMessage remoteMessage) {
        Log.d("PushService", "Message received!");
        
        android.content.SharedPreferences prefs = getSharedPreferences("CapacitorStorage", Context.MODE_PRIVATE);
        String isOnlineStr = prefs.getString("isDeviceOnline", "true");
        String powerStateStr = prefs.getString("deviceOrdersPowerState", "on");
        if ("false".equals(isOnlineStr) || "off".equals(powerStateStr)) {
            Log.d("PushService", "Device power state is OFF. Ignoring push notification.");
            return;
        }
        
        // Check if it has our specific data payload
        if (remoteMessage.getData().size() > 0 && "new_order".equals(remoteMessage.getData().get("type"))) {
            Log.d("PushService", "It's a new order! Triggering full-screen alarm.");
            
            // Wake CPU & Screen aggressively
            try {
                android.os.PowerManager pm = (android.os.PowerManager) getSystemService(Context.POWER_SERVICE);
                if (pm != null) {
                    android.os.PowerManager.WakeLock wl = pm.newWakeLock(
                        android.os.PowerManager.FULL_WAKE_LOCK |
                        android.os.PowerManager.ACQUIRE_CAUSES_WAKEUP |
                        android.os.PowerManager.ON_AFTER_RELEASE,
                        "CafeOrders:PushWakeLock"
                    );
                    wl.acquire(10000);
                }
            } catch (Exception e) {
                Log.e("PushService", "WakeLock error", e);
            }

            // Create the full-screen intent
            Intent fullScreenIntent = new Intent(this, AlarmActivity.class);
            fullScreenIntent.addFlags(
                Intent.FLAG_ACTIVITY_NEW_TASK |
                Intent.FLAG_ACTIVITY_CLEAR_TOP |
                Intent.FLAG_ACTIVITY_SINGLE_TOP |
                Intent.FLAG_ACTIVITY_REORDER_TO_FRONT
            );
            
            // Pass all order fields to AlarmActivity
            if (remoteMessage.getData().containsKey("orderId")) fullScreenIntent.putExtra("orderId", remoteMessage.getData().get("orderId"));
            if (remoteMessage.getData().containsKey("tableNumber")) fullScreenIntent.putExtra("tableNumber", remoteMessage.getData().get("tableNumber"));
            if (remoteMessage.getData().containsKey("customerName")) fullScreenIntent.putExtra("customerName", remoteMessage.getData().get("customerName"));
            if (remoteMessage.getData().containsKey("customerPhone")) fullScreenIntent.putExtra("customerPhone", remoteMessage.getData().get("customerPhone"));
            if (remoteMessage.getData().containsKey("items")) fullScreenIntent.putExtra("items", remoteMessage.getData().get("items"));
            if (remoteMessage.getData().containsKey("subtotal")) fullScreenIntent.putExtra("subtotal", remoteMessage.getData().get("subtotal"));
            if (remoteMessage.getData().containsKey("gst")) fullScreenIntent.putExtra("gst", remoteMessage.getData().get("gst"));
            if (remoteMessage.getData().containsKey("total")) fullScreenIntent.putExtra("total", remoteMessage.getData().get("total"));
            if (remoteMessage.getData().containsKey("notes")) fullScreenIntent.putExtra("notes", remoteMessage.getData().get("notes"));
            if (remoteMessage.getData().containsKey("createdAt")) fullScreenIntent.putExtra("createdAt", remoteMessage.getData().get("createdAt"));

            PendingIntent fullScreenPendingIntent = PendingIntent.getActivity(
                this, 
                (int) System.currentTimeMillis(), 
                fullScreenIntent, 
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
            );

            // Create Notification Channel for Android O and above
            if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.O) {
                android.app.NotificationChannel channel = new android.app.NotificationChannel(
                        "orders_channel",
                        "Incoming Orders",
                        android.app.NotificationManager.IMPORTANCE_HIGH
                );
                channel.setDescription("Full screen alarms for new orders");
                channel.setLockscreenVisibility(android.app.Notification.VISIBILITY_PUBLIC);
                channel.setBypassDnd(true);
                channel.enableVibration(true);
                channel.setVibrationPattern(new long[]{0, 500, 200, 500});
                
                android.app.NotificationManager manager = getSystemService(android.app.NotificationManager.class);
                if (manager != null) {
                    manager.createNotificationChannel(channel);
                }
            }

            String tableNum = remoteMessage.getData().get("tableNumber");
            String totalStr = remoteMessage.getData().get("total");
            String itemsRaw = remoteMessage.getData().get("items");
            String notesStr = remoteMessage.getData().get("notes");
            String orderIdStr = remoteMessage.getData().get("orderId");

            String itemsSummary = formatItemsSummary(itemsRaw);
            String titleText = (tableNum != null && !tableNum.isEmpty()) 
                    ? "🚨 Table #" + tableNum + (totalStr != null ? " — ₹" + totalStr : "")
                    : "🚨 NEW ORDER ARRIVED!";

            // Accept PendingIntent
            Intent acceptIntent = new Intent(this, OrderActionReceiver.class);
            acceptIntent.setAction("com.dreamdesserts.app.ACTION_ACCEPT");
            if (orderIdStr != null) acceptIntent.putExtra("orderId", orderIdStr);
            PendingIntent acceptPendingIntent = PendingIntent.getBroadcast(
                    this,
                    (int) System.currentTimeMillis() + 1,
                    acceptIntent,
                    PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
            );

            // Decline PendingIntent
            Intent declineIntent = new Intent(this, OrderActionReceiver.class);
            declineIntent.setAction("com.dreamdesserts.app.ACTION_DECLINE");
            if (orderIdStr != null) declineIntent.putExtra("orderId", orderIdStr);
            PendingIntent declinePendingIntent = PendingIntent.getBroadcast(
                    this,
                    (int) System.currentTimeMillis() + 2,
                    declineIntent,
                    PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
            );

            StringBuilder bigText = new StringBuilder();
            bigText.append(itemsSummary);
            if (totalStr != null && !totalStr.isEmpty()) bigText.append("\n💰 Total: ₹").append(totalStr);
            if (notesStr != null && !notesStr.isEmpty() && !"null".equalsIgnoreCase(notesStr.trim())) bigText.append("\n📝 Note: ").append(notesStr);

            // Build high-priority notification displaying ordered item names and action buttons
            NotificationCompat.Builder notificationBuilder =
                    new NotificationCompat.Builder(this, "orders_channel")
                    .setSmallIcon(R.mipmap.logo)
                    .setContentTitle(titleText)
                    .setContentText(itemsSummary)
                    .setStyle(new NotificationCompat.BigTextStyle().bigText(bigText.toString()))
                    .setPriority(NotificationCompat.PRIORITY_MAX)
                    .setCategory(NotificationCompat.CATEGORY_ALARM)
                    .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
                    .setFullScreenIntent(fullScreenPendingIntent, true)
                    .setContentIntent(fullScreenPendingIntent)
                    .addAction(R.drawable.btn_accept, "✅ ACCEPT", acceptPendingIntent)
                    .addAction(R.drawable.btn_cancel, "🚫 DECLINE", declinePendingIntent)
                    .setAutoCancel(true);

            NotificationManagerCompat notificationManager = NotificationManagerCompat.from(this);
            try {
                notificationManager.notify(1001, notificationBuilder.build());
                Log.d("PushService", "Notification posted with item names: " + itemsSummary);
            } catch (SecurityException e) {
                Log.e("PushService", "Permission missing for notification", e);
            }

            // Direct activity launch for lockscreen overlay
            try {
                startActivity(fullScreenIntent);
            } catch (Exception e) {
                Log.e("PushService", "Failed to start AlarmActivity directly", e);
            }
            
            return;
        }

        // If it's a standard push notification, let Capacitor handle it normally
        super.onMessageReceived(remoteMessage);
    }

    private String formatItemsSummary(String itemsJsonStr) {
        if (itemsJsonStr == null || itemsJsonStr.trim().isEmpty() || "null".equalsIgnoreCase(itemsJsonStr.trim())) {
            return "Tap to view order items";
        }
        try {
            String cleanJson = itemsJsonStr.trim();
            while (cleanJson.startsWith("\"") && cleanJson.endsWith("\"") && cleanJson.length() > 2) {
                try {
                    cleanJson = new org.json.JSONObject("{ \"str\": " + cleanJson + " }").optString("str", cleanJson);
                } catch (Exception e) {
                    cleanJson = cleanJson.substring(1, cleanJson.length() - 1).replace("\\\"", "\"");
                }
            }
            org.json.JSONArray arr;
            if (cleanJson.startsWith("[")) {
                arr = new org.json.JSONArray(cleanJson);
            } else if (cleanJson.startsWith("{")) {
                org.json.JSONObject obj = new org.json.JSONObject(cleanJson);
                arr = obj.optJSONArray("items");
                if (arr == null) {
                    arr = new org.json.JSONArray();
                    arr.put(obj);
                }
            } else {
                return itemsJsonStr;
            }

            StringBuilder sb = new StringBuilder();
            for (int i = 0; i < arr.length(); i++) {
                org.json.JSONObject item = arr.optJSONObject(i);
                if (item != null) {
                    String name = item.optString("name", item.optString("item_name", item.optString("title", item.optString("itemName", "Item"))));
                    int qty = item.optInt("qty", item.optInt("quantity", 1));
                    double price = item.optDouble("price", item.optDouble("rate", item.optDouble("cost", 0)));
                    if (sb.length() > 0) sb.append(", ");
                    sb.append(qty).append("× ").append(name);
                    if (price > 0) sb.append(" (₹").append(Math.round(price * qty)).append(")");
                } else {
                    if (sb.length() > 0) sb.append(", ");
                    sb.append(arr.optString(i));
                }
            }
            return sb.length() > 0 ? sb.toString() : "Tap to view order items";
        } catch (Exception e) {
            return "Tap to view order items";
        }
    }
}
