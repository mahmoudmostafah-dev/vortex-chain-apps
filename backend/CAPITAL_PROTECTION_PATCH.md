# Capital Protection Mode - Manual Patch

## تعديل يدوي مطلوب في bot-modular.js

في السطر **955** تقريباً، ابحث عن:

```javascript
        } else {
          const positionsList = Object.entries(this.positions)
            .map(([symbol, pos]) => `${symbol} @ ${pos.entry.toFixed(4)}`)
            .join(', ');
          this.logger.info(
            `📊 Max positions reached (${this.config.risk.maxPositions}): ${positionsList}`
          );
        }
```

**استبدله بـ:**

```javascript
        } else if (this.marketMonitor.isProtectionActive()) {
          const remaining = this.marketMonitor.getProtectionTimeRemaining();
          this.logger.warning(
            `🔒 Capital Protection Mode active - Trading blocked for ${remaining} more minutes`
          );
        } else {
          const positionsList = Object.entries(this.positions)
            .map(([symbol, pos]) => `${symbol} @ ${pos.entry.toFixed(4)}`)
            .join(', ');
          this.logger.info(
            `📊 Max positions reached (${this.config.risk.maxPositions}): ${positionsList}`
          );
        }
```

## التحقق

بعد التعديل، تأكد من:

1. ✅ `MarketMonitorService` تم استيراده في أعلى الملف
2. ✅ `this.marketMonitor = new MarketMonitorService(...)` في الـ constructor
3. ✅ `await this.checkCapitalProtection()` في الـ main loop
4. ✅ الشرط `!this.marketMonitor.isProtectionActive()` في scanMarket

## اختبار

```bash
# إعادة بناء
docker-compose build --no-cache backend

# تشغيل
docker-compose up -d

# مراقبة
docker-compose logs -f backend | grep -E "(PROTECTION|🔒)"
```

## ملاحظة

هذا التعديل اليدوي مطلوب فقط إذا فشل الـ strReplace التلقائي.
الكود الباقي تم إضافته بنجاح.
