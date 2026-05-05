---
name: ĐÚNG LOOK Generator project
description: Sticker generator cho RIO Sustainable Branding — booth triển lãm, data-driven SVG composition, GitHub Pages
type: project
originSessionId: f856b78a-8689-4a05-bd8c-cfb25a990a02
---
ĐÚNG LOOK Generator là sticker generator chạy trên trình duyệt, dùng tại booth triển lãm của RIO Sustainable Branding. Mỗi lần Generate, app random ghép các layer SVG thành 1 sticker nhân vật + text 3 dòng (prefix + "đúng look" + suffix). User Download SVG hoặc PNG.

**Triết lý cốt lõi (TUYỆT ĐỐI không vi phạm):** Figma = nguồn design, GitHub = vận hành, user = non-code. Mọi thứ data-driven: code KHÔNG hardcode tên asset hay số layer. Thêm asset mới = drop SVG vào folder + push → website tự update trong 1 phút (qua GitHub Actions chạy `scripts/build.js` → ghi `data/manifest.json` → deploy Pages).

**Why:** Sticker giveaway tại booth — tốc độ + tự động hoá quan trọng hơn perfectionism. User non-code nên mọi update phải ở mức "drop file rồi đợi 1 phút".

**How to apply:** Khi user yêu cầu thay đổi, hỏi trước: "việc này có đụng vào triết lý data-driven không?" Nếu có (ví dụ hardcode tên file), tìm cách khác (đọc từ manifest / config). Khi user gửi Figma update, đo lại tọa độ và update các `_config.json` chứ không thêm logic mới.

**Cấu trúc layer hiện tại (3 layers, mỗi folder có `_config.json`):**
- `01_base` — `fixed_center`, required p=1.0, không recolor
- `02_eyes` — `fixed_position` (anchor 350,250), required p=1.0, không recolor
- `03_sticker` — `random_corner` (1 trong 4 góc, padding 60), p=0.85, **colorize=true** (random từ palette), rotation continuous -45°→45°

Mở rộng: tạo `assets/04_xxx/_config.json` → app tự nhận. Behavior enum trong code: `fixed_center` | `fixed_position` | `random_corner`.

**Color palette (`content/colors.json`):** 6 hex từ Figma — `#009ada` (xanh) · `#f99d1c` (cam đậm) · `#ad75b2` (tím) · `#5dbb4c` (xanh lá) · `#ec008c` (hồng) · `#f47421` (cam). Sticker recolor random từ palette này. Prefix/suffix text mỗi cái cũng random color độc lập từ palette. Core text "đúng look" giữ màu thiết kế (trắng trên bg tối idle, đen trên card sáng finalized).

**Design tokens (Figma → CSS variables trong style.css):** `--bg-page #050505`, `--bg-card #d3e8f0`, `--border-card #009ada`, `--border-btn #f47421`, `--accent-pink #ec008c`, frame radius 37px, header 87px, btn 300×74px, canvas 700×700.

**Fonts:** Display "Bagel Fat One" (Google Font, fallback cho BD StreetSign Sans), text "Be Vietnam Pro". Cả hai load từ Google Fonts trong `index.html`.

**UX behaviors (đã chốt):**
- Idle: auto-shuffle 200ms (canvas tự reshuffle nhanh để hấp dẫn người đi qua)
- Click Generate: animation tăng tốc → giảm tốc rồi dừng, button có state busy với spinner + dots, canvas có shake animation
- Finalized: canvas đổi sang background card sáng (`#d3e8f0`) + border xanh, có pop scale animation, hiện download group, button label đổi "Look khác"
- Click lần 2: reset về idle + auto-shuffle, button label về "Generate"
- QR feature **đã ẩn** (user yêu cầu hide). Download chỉ có SVG + PNG.
- PNG export: Canvas 2x scale = 1400×1400, await `document.fonts.ready` trước khi vẽ. Download không có border ngoài Image Frame.

**Stack:** Vanilla JS không framework. `xlsx` (npm) đọc `content/text-lists.xlsx` trong build (sheet 1, columns `prefix` và `suffix`). SVG inline composition qua DOMParser + `<g>` wrappers với transforms. Recolor sticker bằng cách query path/rect/circle/etc và override `fill` attribute (skip elements có `fill="none"`).

**Repo:** `docteurmeo/dunglook-generator`. Local: `C:\Users\Dinhchan\Desktop\dunglook\dunglook-generator`. Deploy: `https://docteurmeo.github.io/dunglook-generator/`. Auth qua GitHub Desktop OAuth, **không dùng PAT** (user từng leak token trong chat).

**Manifest schema (`data/manifest.json` được build.js sinh ra):** `{generatedAt, artFrame:{width:700,height:700}, textFrame:{x:263,y:500,width:174,height:164}, coreText:"đúng look", layers:[{folder, name, order, behavior, required, probability, viewBox, renderSize, renderOffset, anchor, container, padding, rotation, colorize, assets:[{file, path}]}], text:{prefix:[], suffix:[]}, colors:[]}`.
