# 🎌 بوت الأنمي المدبلج - دليل الإعداد الكامل

## المشروع يتكون من:
- **Telegram Bot** - بوت تليجرام كامل
- **Admin Dashboard** - لوحة تحكم على Netlify
- **Supabase** - قاعدة البيانات
- **SwiftLnx** - اختصار الروابط

---

## 📋 الخطوة 1: إعداد Supabase

1. افتح [Supabase Dashboard](https://supabase.com/dashboard)
2. اختر مشروعك: `karymtodznojroucgzqq`
3. اذهب لـ **SQL Editor**
4. انسخ محتوى ملف `sql/schema.sql` والصقه وشغله
5. من **Settings > API**، انسخ **service_role** key

---

## 📋 الخطوة 2: رفع على GitHub

```bash
# في مجلد المشروع
git init
git add .
git commit -m "Initial anime bot"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/anime-bot.git
git push -u origin main
```

---

## 📋 الخطوة 3: Netlify

1. افتح [Netlify](https://app.netlify.com)
2. **Add new site > Import from GitHub**
3. اختر المستودع
4. اضبط:
   - Build command: (فارغ)
   - Publish directory: `public`
5. اضغط **Deploy**

### إضافة متغيرات البيئة:
في **Site Settings > Environment Variables** أضف:

| المتغير | القيمة |
|---------|--------|
| `TELEGRAM_BOT_TOKEN` | `8653592455:AAGDWtqS5-U8hu0RixYEUCMqwSfwEU2Ibfo` |
| `SUPABASE_URL` | `https://karymtodznojroucgzqq.supabase.co` |
| `SUPABASE_SERVICE_KEY` | (service_role key من Supabase) |
| `ADMIN_TOKEN` | كلمة مرور قوية تختارها |
| `SWIFTLNX_API_KEY` | `bb004ba55a1b965b3e5e8b46466a66d06fa7775d` |

---

## 📋 الخطوة 4: تفعيل البوت

بعد النشر، افتح لوحة التحكم:
`https://YOUR-SITE.netlify.app`

1. ادخل كلمة مرور ADMIN_TOKEN
2. اضغط زر **"تفعيل البوت"** في الأعلى
3. سيتم ربط الويب هوك تلقائياً ✅

---

## 🗂️ هيكل المشروع

```
anime-bot/
├── netlify/
│   └── functions/
│       ├── webhook.js      # معالج رسائل البوت
│       ├── admin-api.js    # API لوحة التحكم
│       └── setup.js        # تفعيل الويب هوك
├── public/
│   ├── css/
│   │   └── admin.css       # تصميم لوحة التحكم
│   ├── js/
│   │   └── admin.js        # منطق لوحة التحكم
│   └── index.html          # لوحة التحكم
├── sql/
│   └── schema.sql          # قاعدة البيانات
├── netlify.toml
├── package.json
└── .env.example
```

---

## 🤖 كيف يعمل البوت

### للمستخدم:
1. `/start` → قائمة التصنيفات
2. يضغط تصنيف → قائمة المحتوى
3. يضغط فيلم → جودات التحميل مباشرة + زر تفاصيل
4. يضغط مسلسل → قائمة الحلقات + زر تفاصيل
5. يضغط حلقة → جودات التحميل
6. يضغط جودة → رابط التحميل + زر الشرح

### للأدمن (لوحة التحكم):
- **داشبورد**: إحصائيات + مخططات
- **التصنيفات**: إضافة/تعديل/حذف
- **المحتوى**: إدارة الأفلام والمسلسلات
- **الحلقات**: إضافة حلقات للمسلسلات
- **الروابط**: إضافة روابط بجودات مختلفة
- **المستخدمين**: عرض وحظر
- **رسائل جماعية**: بث للجميع
- **اختصار الروابط**: SwiftLnx مدمج
- **الإعدادات**: تخصيص البوت

---

## ⚠️ ملاحظة مهمة

احتفظ بـ `ADMIN_TOKEN` سراً تاماً، هو مفتاح التحكم الكامل بالبوت!
