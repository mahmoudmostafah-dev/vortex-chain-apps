# Deployment Guide - v5.1

## New Features

### 1. OCO Orders (One-Cancels-the-Other)

- حماية الصفقات على Binance مباشرة
- Stop Loss + Take Profit تلقائي
- يعمل حتى لو البوت متوقف

### 2. Capital Protection Mode

- حماية تلقائية من انهيارات السوق
- إيقاف التداول عند انخفاض BTC -1.5% في 5 دقائق
- إلغاء الأوامر المعلقة تلقائياً

## Deployment Steps

### 1. إيقاف البوت الحالي

```bash
cd ~/vortex-chain-apps
docker-compose down
```

### 2. Pull التحديثات

```bash
git pull origin main
# أو إذا كنت تعمل محلياً، انسخ الملفات الجديدة
```

### 3. إعادة بناء الـ Container

```bash
docker-compose build --no-cache backend
```

### 4. تشغيل Migration (للـ OCO Orders)

```bash
docker-compose run --rm backend node migrate-add-oco.js
```

### 5. تشغيل البوت

```bash
docker-compose up -d
```

### 6. مراقبة الـ Logs

```bash
docker-compose logs -f backend
```

## التحقق من الميزات الجديدة

### OCO Orders

ابحث في الـ logs عن:

```bash
docker-compose logs backend | grep "OCO"
```

يجب أن تشوف:

```
🛡️ OCO Order created for BTC/USDT | SL: 44000 | TP: 48000
```

### Capital Protection

ابحث في الـ logs عن:

```bash
docker-compose logs backend | grep "PROTECTION"
```

عند حدوث انهيار، ستشوف:

```
🔒 CAPITAL PROTECTION MODE ACTIVATED
```

## الإعدادات الاختيارية

### تخصيص Capital Protection

في `backend/src/config/settings.js`:

```javascript
protection: {
  enabled: true,                // تفعيل/تعطيل
  btcDropThreshold: -1.5,       // -1.5% في 5 دقائق
  redMarketThreshold: 70,       // 70% سوق أحمر
  protectionDurationMin: 2,     // ساعتين
  protectionDurationMax: 4,     // 4 ساعات
}
```

### إضافة OCO للمراكز الموجودة (اختياري)

إذا كان عندك مراكز مفتوحة قبل التحديث:

```bash
docker-compose exec backend node add-oco-to-existing.js
```

## Rollback (إذا حدثت مشاكل)

```bash
# إيقاف البوت
docker-compose down

# العودة للإصدار السابق
git checkout v5.0

# إعادة بناء
docker-compose build --no-cache backend

# تشغيل
docker-compose up -d
```

## Support

إذا واجهت مشاكل:

1. تحقق من الـ logs: `docker-compose logs backend`
2. راجع الـ documentation في `docs/`
3. تأكد من API permissions على Binance

## Version Info

- **Version**: 5.1
- **Release Date**: November 2025
- **Breaking Changes**: None
- **Migration Required**: Yes (for OCO Orders)
