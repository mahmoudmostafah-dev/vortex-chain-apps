# نشر تحديث OCO Orders

## الخطوات المطلوبة

### 1. إيقاف البوت الحالي

```bash
cd ~/vortex-chain-apps
docker-compose down
```

### 2. تحديث الكود

الكود محدث بالفعل في المجلد، فقط نحتاج إعادة بناء الـ container:

```bash
docker-compose build --no-cache backend
```

### 3. تشغيل Migration داخل Container

```bash
# تشغيل container مؤقت لعمل migration
docker-compose run --rm backend node migrate-add-oco.js
```

### 4. تشغيل البوت

```bash
docker-compose up -d
```

### 5. التحقق من الـ Logs

```bash
docker-compose logs -f backend
```

ابحث عن:

- ✅ `OCO Order created for...` - يعني OCO Order اتعمل بنجاح
- ⚠️ `OCO Order failed...` - يعني في مشكلة (هيستخدم المراقبة العادية)

## ملاحظات مهمة

### Paper Trading Mode

- في وضع Paper Trading، **لن يتم إنشاء OCO Orders فعلية**
- البوت سيستمر في المراقبة العادية
- OCO Orders تعمل فقط في Live Trading

### إذا كان عندك مراكز مفتوحة حالياً

المراكز الـ 9 الموجودة حالياً:

- **لن يتم إنشاء OCO Orders لهم** (لأنهم مفتوحين قبل التحديث)
- البوت سيستمر في مراقبتهم بالطريقة العادية
- **المراكز الجديدة فقط** ستحصل على OCO Orders

### للمراكز الحالية (اختياري)

إذا تريد حماية المراكز الحالية بـ OCO Orders:

```bash
# داخل container
docker-compose exec backend node -e "
const VortexBot = require('./src/bot-modular');
const bot = new VortexBot();
(async () => {
  await bot.init();
  // سيتم إضافة script لإنشاء OCO للمراكز الموجودة
})();
"
```

## التحقق من OCO Orders على Binance

1. افتح Binance Web/App
2. اذهب إلى **Spot Trading**
3. اضغط على **Open Orders**
4. ستجد أوامر OCO لكل صفقة مفتوحة

## Troubleshooting

### إذا فشل إنشاء OCO Order

الأسباب المحتملة:

1. **API Permissions**: تأكد أن API Key عندك صلاحيات Trading
2. **Insufficient Balance**: رصيد غير كافي
3. **Price Filters**: السعر خارج نطاق Binance المسموح

البوت سيستمر في العمل بالمراقبة العادية إذا فشل OCO.

### إذا البوت لم يكتشف تنفيذ OCO

- تحقق من الـ logs: `docker-compose logs backend | grep OCO`
- البوت يتحقق كل دقيقة من حالة OCO Orders
- إذا استمرت المشكلة، أعد تشغيل البوت

## الفوائد بعد التحديث

✅ حماية 24/7 للصفقات الجديدة
✅ أمان أعلى حتى لو البوت توقف
✅ تنفيذ فوري من Binance
✅ راحة بال أكثر

## الخطوة التالية

بعد التأكد من عمل OCO Orders بنجاح، يمكنك:

- مراقبة الصفقات الجديدة
- التحقق من Binance أن الأوامر موجودة
- الاطمئنان أن الصفقات محمية
