# OCO Orders (One-Cancels-the-Other)

## Overview

تم إضافة نظام OCO Orders لحماية الصفقات حتى لو توقف البوت عن العمل. عند فتح أي صفقة، يتم وضع أوامر Stop Loss و Take Profit مباشرة على Binance نفسها.

## كيف يعمل؟

### 1. عند فتح صفقة جديدة

```
1. البوت يضع Limit Buy Order
2. عند التنفيذ، يتم إنشاء OCO Order تلقائياً:
   - Stop Loss Order (حماية من الخسارة)
   - Take Profit Order (جني الأرباح)
3. يتم حفظ OCO Order ID في الـ database
```

### 2. أثناء تشغيل البوت

```
- البوت يتحقق من OCO Orders كل دقيقة
- إذا اتنفذ أحد الأوامر (SL أو TP):
  - يتم تحديث الـ database تلقائياً
  - إرسال إشعار على Telegram
  - حذف الصفقة من المراكز المفتوحة
```

### 3. إذا توقف البوت

```
✅ الصفقات محمية!
- Binance ستنفذ Stop Loss تلقائياً عند الوصول للسعر
- Binance ستنفذ Take Profit تلقائياً عند الوصول للسعر
- عند إعادة تشغيل البوت، سيكتشف التغييرات ويحدث الـ database
```

## الفرق بين النظام القديم والجديد

### النظام القديم ❌

```
- البوت يراقب الأسعار بنفسه
- إذا توقف البوت = لا حماية
- خطر خسارة كبيرة إذا تحرك السعر
```

### النظام الجديد ✅

```
- Binance تراقب الأسعار 24/7
- حماية دائمة حتى لو البوت متوقف
- أمان أعلى للصفقات
```

## Paper Trading Mode

في وضع Paper Trading:

- لا يتم إنشاء OCO Orders فعلية
- البوت يراقب الأسعار بنفسه (محاكاة)
- مناسب للاختبار فقط

## Migration

لتحديث database موجود:

```bash
cd backend
node migrate-add-oco.js
```

هذا سيضيف column جديد `oco_order_id` للـ positions table.

## Technical Details

### OCO Order Structure

```javascript
{
  symbol: 'BTC/USDT',
  side: 'SELL',
  quantity: 0.001,
  price: 50000,           // Take Profit
  stopPrice: 45000,       // Stop Loss trigger
  stopLimitPrice: 44775,  // Stop Loss execution (0.5% below)
  stopLimitTimeInForce: 'GTC'
}
```

### Database Schema

```sql
CREATE TABLE positions (
  symbol TEXT PRIMARY KEY,
  entry_price REAL NOT NULL,
  amount REAL NOT NULL,
  highest_price REAL NOT NULL,
  stop_loss REAL NOT NULL,
  take_profit REAL NOT NULL,
  atr_stop REAL,
  oco_order_id TEXT,      -- ✅ NEW
  timestamp INTEGER NOT NULL
);
```

## Monitoring

البوت يتحقق من OCO Orders في `managePositions()`:

1. يجلب Open Orders من Binance
2. يبحث عن OCO Order ID
3. إذا اختفى = تم التنفيذ
4. يحدث الـ database ويرسل إشعار

## Benefits

✅ حماية 24/7 حتى لو البوت متوقف
✅ تنفيذ فوري من Binance
✅ لا حاجة لمراقبة مستمرة
✅ أمان أعلى للصفقات
✅ راحة بال للمتداول

## Limitations

⚠️ يعمل فقط في Live Trading (ليس Paper Trading)
⚠️ يحتاج API permissions على Binance
⚠️ Binance fees تطبق على كل أمر

## Next Steps

بعد تطبيق هذا التحديث:

1. شغل migration script
2. أعد تشغيل البوت
3. راقب الـ logs للتأكد من إنشاء OCO Orders
4. تحقق من Binance UI أن الأوامر موجودة

## Support

إذا واجهت مشاكل:

- تحقق من API permissions على Binance
- راجع الـ logs في `backend/logs/`
- تأكد من تشغيل migration script
