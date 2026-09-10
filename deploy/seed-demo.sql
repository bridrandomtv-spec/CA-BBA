-- Contenu de démonstration CABBA (actualités, boutique, صندوق دعم النادي).
-- À exécuter dans pgAdmin (Query Tool -> File -> Open) ou Neon SQL Editor.
-- Schéma réel vérifié sur les migrations : news(title, content, image_url),
-- products(name, description, price, image_url, category, stock, active).
-- Idempotent : ne fait rien si du contenu existe déjà.

DO $$
DECLARE
  uid uuid;
  cid uuid;
BEGIN
  IF (SELECT count(*) FROM news) > 0 OR (SELECT count(*) FROM support_campaigns) > 0 THEN
    RAISE NOTICE 'Contenu de démo déjà présent — rien n''a été inséré.';
    RETURN;
  END IF;

  SELECT id INTO uid FROM users WHERE email = 'brid.randomtv@gmail.com';

  INSERT INTO news (title, content, image_url) VALUES
   ('افتتاح المتجر الرسمي للأنصار',
    'يسعد إدارة نادي شباب أهلي برج بوعريريج أن تعلن عن افتتاح المتجر الرسمي للأنصار: أوشحة، قمصان ومنتجات تخلد ألوان الجراد الأصفر. الأسعار في متناول الجميع والعائدات تدعم خزينة النادي.',
    ''),
   ('برنامج تحضيرات الفريق الأول',
    'يواصل الفريق الأول تحضيراته للموسم المقبل بحصص يومية بملعب 20 أوت. الدعوة مفتوحة للأنصار لحضور الحصص المسائية ومساندة اللاعبين.',
    ''),
   ('حملة الانخراطات للموسم الجديد',
    'انطلقت حملة الانخراطات للموسم الجديد: بطاقة العضوية تشمل امتيازات الدخول المسبق وخصومات على المتجر. سجلوا لدى إدارة النادي أو عبر المنصة.',
    '');

  INSERT INTO products (name, description, price, image_url, category, stock, active) VALUES
   ('وشاح الجراد الأصفر', 'وشاح رسمي بألوان النادي، قماش متين للاستعمال في المدرجات.', 1200, '', 'تشجيع', 50, true),
   ('قميص النادي 2026', 'قميص رسمي بقصة عصرية باللونين الأصفر والأسود.', 3500, '', 'ملابس', 30, true),
   ('كأس تذكارية مصغرة', 'نسخة مصغرة من كأس البطولة بقاعدة منقوشة بشعار النادي.', 2500, '', 'هدايا', 15, true),
   ('بطاقة عضو شرف', 'بطاقة رمزية لدعم النادي مع تسجيل اسم المتبرع في سجل الشرف.', 5000, '', 'عضويات', 100, true);

  INSERT INTO support_campaigns (title, goal_dzd, bank_info, active, created_by) VALUES
   ('صندوق دعم الفريق الأول', 5000000,
    'حساب CCP: 123456789 مفتاح 42' || chr(10) || 'أو صندوق النادي بمقر الفريق يومياً من 17h إلى 20h',
    true, uid)
  RETURNING id INTO cid;

  INSERT INTO support_donations (campaign_id, amount_dzd, donor_name, method, note, recorded_by) VALUES
   (cid,  50000, 'متبرع مجهول',    'cash',     '',                 uid),
   (cid, 100000, 'أسرة بن علي',    'ccp',      'تحويل رقم 4521',  uid),
   (cid,  25000, 'مشجع من المهجر', 'transfer', 'دعم من الجالية',  uid);

  RAISE NOTICE 'Contenu de démo inséré : 3 actualités, 4 produits, 1 campagne + 3 dons.';
END $$;

-- Pour tout effacer après la démo :
-- DELETE FROM support_donations; DELETE FROM support_campaigns;
-- DELETE FROM products; DELETE FROM news;
