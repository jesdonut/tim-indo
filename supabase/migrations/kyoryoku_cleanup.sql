-- 協力確認書: 自治体マスタのクリーンアップ
-- seed の自治体名は CSV の生値。都道府県・郡・全角空白・改行・末尾「長」が混入し、
-- 同じ自治体が最大9行に重複していた（114行 → 94行）。宛名にそのまま使うため正規化する。
--   ・都道府県／郡は含めない（ただし「郡山市」のように名前に郡を含む市は壊さない）
--   ・政令指定都市は市レベル（申請先URLが市で一本化されているため）
--   ・東京23区は特別区＝自治体そのものなので区のまま
-- ※ Supabase SQLエディタは文ごとにコミットするため、temp table ではなく通常テーブルを使う。

drop table if exists _muni_map;
create table _muni_map(raw text primary key, canon text);
insert into _muni_map(raw, canon) values
  ('北海道石狩市', '石狩市'),
  ('東京都中央区', '中央区'),
  ('横浜市中区', '横浜市'),
  ('鹿児島県薩摩川内市', '薩摩川内市'),
  ('鹿児島県南さつま市', '南さつま市'),
  ('神奈川県川崎市', '川崎市'),
  ('東京都綾瀬市', '綾瀬市'),
  ('福岡県久留米市', '久留米市'),
  ('栃木県下都郡野木町', '野木町'),
  ('福岡県嘉麻市', '嘉麻市'),
  ('神奈川県横浜市', '横浜市'),
  ('東京都練馬区', '練馬区'),
  ('佐賀県鳥栖市', '鳥栖市'),
  ('北海道札幌市', '札幌市'),
  ('熊本県阿蘇郡西原村', '西原村'),
  ('茨城県鹿嶋市', '鹿嶋市'),
  ('熊本県熊本市', '熊本市'),
  ('埼玉県さいたま市', 'さいたま市'),
  ('千葉県市原市', '市原市'),
  ('長野県北佐久郡軽井沢町', '軽井沢町'),
  ('広島県広島市', '広島市'),
  ('東京都葛飾区', '葛飾区'),
  ('浜松市西区', '浜松市'),
  ('鳥取県鳥取市', '鳥取市'),
  ('北九州市八幡東区', '北九州市'),
  ('東京都板橋区', '板橋区'),
  ('千葉県松戸市', '松戸市'),
  ('千葉県千葉市', '千葉市'),
  ('北海道小樽市', '小樽市'),
  ('大分県竹田市', '竹田市'),
  ('長崎県島原市', '島原市'),
  ('静岡県熱海市', '熱海市'),
  ('静岡県掛川市', '掛川市'),
  ('三重県四日市', '四日市市'),
  ('広島県福山市', '福山市'),
  ('岡山県瀬戸内市', '瀬戸内市'),
  ('埼玉県戸田市', '戸田市'),
  ('福島県郡山市', '郡山市'),
  ('徳島県鳴門市', '鳴門市'),
  ('栃木県小山市', '小山市'),
  ('千葉県流山市', '流山市'),
  ('東京都杉並区', '杉並区'),
  ('東京都大田区', '大田区'),
  ('横浜市港北区', '横浜市'),
  ('東京都新宿区', '新宿区'),
  ('東京都港区', '港区'),
  ('東京都品川区', '品川区'),
  ('香川県坂出市', '坂出市'),
  ('福岡市', '福岡市'),
  ('福岡市早良区', '福岡市'),
  ('大分県大分市', '大分市'),
  ('東京都千代田', '千代田区'),
  ('足柄下郡箱根町', '箱根町'),
  ('千葉県勝浦市
長野県茅野市', '勝浦市'),
  ('神戸市灘区', '神戸市'),
  ('福岡県筑後市', '筑後市'),
  ('大崎上島町長', '大崎上島町'),
  ('千葉県成田市', '成田市'),
  ('西東京市', '西東京市'),
  ('横浜市', '横浜市'),
  ('富士見市', '富士見市'),
  ('埼玉県所沢市', '所沢市'),
  ('東京都世田谷区', '世田谷区'),
  ('船橋市', '船橋市'),
  ('埼玉県北本市', '北本市'),
  ('東京都文京区', '文京区'),
  ('愛知県名古屋市', '名古屋市'),
  ('愛知県岩倉市', '岩倉市'),
  ('愛媛県四国中央市', '四国中央市'),
  ('福岡県行橋市', '行橋市'),
  ('山口県下関市', '下関市'),
  ('山口県萩市', '萩市'),
  ('福岡県福岡市', '福岡市'),
  ('大分県中津市', '中津市'),
  ('熊本県玉名市', '玉名市'),
  ('神奈川県小田原市', '小田原市'),
  ('兵庫県南あわじ市', '南あわじ市'),
  ('東京都渋谷区', '渋谷区'),
  ('横浜市南区', '横浜市'),
  ('横浜市旭区', '横浜市'),
  ('東京都八王子市', '八王子市'),
  ('群馬県伊勢崎市', '伊勢崎市'),
  ('横浜市青葉区', '横浜市'),
  ('東京都三鷹市', '三鷹市'),
  ('田川郡福智町', '福智町'),
  ('北海道釧路市', '釧路市'),
  ('横浜市都筑区', '横浜市'),
  ('横浜市磯子区', '横浜市'),
  ('東京都府中市', '府中市'),
  ('北海道北広島市', '北広島市'),
  ('神奈川県愛甲郡愛川町', '愛川町'),
  ('千葉市緑区', '千葉市'),
  ('神戸市須磨区', '神戸市'),
  ('佐賀県武雄市', '武雄市'),
  ('群馬県吾妻郡嬬恋村', '嬬恋村'),
  ('秋田市', '秋田市'),
  ('埼玉県川口市', '川口市'),
  ('さいたま市岩槻区', 'さいたま市'),
  ('福岡県　遠賀郡岡垣町', '岡垣町'),
  ('福岡県田川郡添田町', '添田町'),
  ('千葉県浦安市', '浦安市'),
  ('徳島県徳島市', '徳島市'),
  ('広島県東広島市', '東広島市'),
  ('広島市', '広島市'),
  ('東京都　港区', '港区'),
  ('埼玉県　川口市', '川口市'),
  ('千葉県　浦安市', '浦安市'),
  ('東京都　世田谷区', '世田谷区'),
  ('東京都　国立市', '国立市'),
  ('愛知県　長久手市', '長久手市'),
  ('徳島県　美馬市', '美馬市'),
  ('広島県　福山市', '福山市'),
  ('長崎県　島原市', '島原市'),
  ('福岡県　豊前市', '豊前市');

-- 空レコード（スプレッドシートの区切り行）を削除
delete from public.kyoryoku_submissions
where store_name is null and store_code is null and store_address is null;

-- 正規名ごとに残す1行を決める（情報が埋まっている行を優先）
drop table if exists _keeper;
create table _keeper as
select distinct on (mm.canon) mm.canon, m.id as keep_id
from _muni_map mm
join public.municipalities m on m.name = mm.raw
order by mm.canon,
         (m.email is not null) desc,
         (m.form_url is not null) desc,
         (m.submission_method <> '未調査') desc,
         m.id;

-- 提出記録を keeper に付け替え
update public.kyoryoku_submissions s
set municipality_id = k.keep_id
from public.municipalities m
join _muni_map mm on mm.raw = m.name
join _keeper k on k.canon = mm.canon
where s.municipality_id = m.id and s.municipality_id <> k.keep_id;

-- keeper 以外の重複行を削除
delete from public.municipalities m
using _muni_map mm, _keeper k
where m.name = mm.raw and k.canon = mm.canon and m.id <> k.keep_id;

-- keeper を正規名にリネーム
update public.municipalities m
set name = k.canon
from _keeper k
where m.id = k.keep_id and m.name <> k.canon;

-- form_url にメールアドレスが入っている行を修正（西東京市など）
update public.municipalities
set email = coalesce(email, form_url), form_url = null
where form_url is not null and form_url not like 'http%';

-- 救世軍恵泉ホーム: 住所は東京都清瀬市、申請URLも city.kiyose.lg.jp。
-- 元データの宛名が「綾瀬市」(誤記) だったので清瀬市へ付け替える。
insert into public.municipalities(name, submission_method, form_url)
select '清瀬市', '電子申請システム',
       'https://www.city.kiyose.lg.jp/kurashi/kurasinosoudan/1009391/1014847.html'
where not exists (select 1 from public.municipalities where name = '清瀬市');

update public.kyoryoku_submissions
set municipality_id = (select id from public.municipalities where name = '清瀬市')
where store_name = '救世軍恵泉ホーム';

delete from public.municipalities m
where m.name = '綾瀬市'
  and not exists (select 1 from public.kyoryoku_submissions s where s.municipality_id = m.id);

drop table _muni_map;
drop table _keeper;
