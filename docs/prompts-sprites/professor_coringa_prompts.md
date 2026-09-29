# Professor CORINGA 🃏 — prompts divididos por pose (7 poses)

> O CORINGA não representa uma matéria fixa: suas perguntas são sorteadas de todas as matérias do curso (Algoritmos, Fundamentos de TI e todas as demais). Persona: o professor eclético e imprevisível, dono do "quiz surpresa", que mistura referências de todas as áreas. Personagem: o antigo visual de POO (jaqueta verde-oliva sobre camiseta branca), com identidade própria. Ultimate: "PROVA SURPRESA".

> **Como usar (Google Flow / Whisk):** para cada prompt abaixo, anexe a **imagem do modelo do Professor Coringa** como referência de sujeito/personagem e cole o prompt no campo de texto. Gere como **imagem**, uma pose por vez.
> **Sem texto:** os prompts proíbem qualquer título, label ou letra na imagem — sprites puros sobre fundo branco, prontos para recortar.

## Prompt negativo (use em todos)

```
text, letters, words, labels, captions, titles, watermarks, signature, blurry, anti-aliasing, smooth gradients, vector art, cartoon, chibi, 3D render, realistic, photo, different outfit between frames, inconsistent character, different style between frames, frames or boxes around sprites, misspelled text, extra limbs, deformed hands, overlapping sprites, background scenery, vertically stacked frames, sprites arranged one above another, portrait layout, collage layout, cropped sprites, cut-off legs, clipped feet, torso-only sprites, scattered dust particles, floating specks, tiny detached glow fragments, fading pixel debris, identical duplicate frames within a pose group, copy-pasted sprites, the same drawing repeated, mirrored or traced copies of the same frame
```

---

## 1. IDLE (PARADO) — 2 quadros

```
STYLE LOCK: authentic 2D pixel art in the look of 90s arcade fighting games (Street Fighter Alpha, King of Fighters '98), semi-realistic proportions with a normal-sized head (about 7 heads tall, not chibi, not cartoon), every sprite drawn on a native pixel grid about 96 px tall and upscaled with nearest-neighbor so the square pixels are visible, 1px near-black outline, hard-edged cel shading with exactly 3 tones per material plus one highlight, muted natural colors, no gradients, no blur, no anti-aliasing, no dithering, no smooth vector look, same pixel size in every frame

REFERENCE IMAGE LOCK (highest priority): use the provided character reference image as the ground truth for the character's appearance. Match it exactly in every frame — same face, same hair and beard, same body type, same outfit, same accessories, same colors and proportions. Do not redesign or reinterpret the character.

FRAME VARIATION RULE (critical): every frame MUST be a visibly different drawing — never duplicate, copy-paste, mirror or lightly trace one frame to make the next.

Character (identical in every frame, always facing right): average height bald man, sturdy average build with broad shoulders, only a very subtle soft midsection (not overweight), fair light skin, smooth bald head with a high rounded forehead, blue-gray eyes, friendly confident smile, short, close-cropped, low-volume beard hugging the jaw and chin (not bushy, not thick), light brown with warm golden tones, dark olive green casual jacket worn open over a plain white t-shirt, dark blue jeans, white sneakers.

Output format: one wide horizontal LANDSCAPE image (16:9 aspect ratio or wider), never portrait or square. Image content: exactly 2 sprites of this character on a plain white background, side by side in ONE single horizontal row (NEVER stacked vertically, never one above another, both sprites aligned on the same horizontal baseline at the same height), clearly separated and never overlapping, every sprite showing the FULL BODY from head to feet, never cropped or clipped at the waist, knees or image edge, nothing else — no text, no labels, no boxes, no scenery. The 2 sprites MUST be in chronological order, frame 1 (inhale) on the left and frame 2 (exhale) on the right. IDLE breathing loop — a seamless 2-frame animation cycle: frame 2 must flow naturally back into frame 1 so the loop repeats endlessly without a visual jump: frame 1 relaxed fighting stance with chest slightly raised on an inhale; frame 2 the same stance with chest and shoulders slightly lowered on an exhale, arms hanging a touch lower and knees a touch more bent — a small difference, but the two frames must still be visibly distinguishable drawings, never the exact same sprite duplicated.
```

---

## 2. WALK (ANDAR) — 4 quadros

```
STYLE LOCK: authentic 2D pixel art in the look of 90s arcade fighting games (Street Fighter Alpha, King of Fighters '98), semi-realistic proportions with a normal-sized head (about 7 heads tall, not chibi, not cartoon), every sprite drawn on a native pixel grid about 96 px tall and upscaled with nearest-neighbor so the square pixels are visible, 1px near-black outline, hard-edged cel shading with exactly 3 tones per material plus one highlight, muted natural colors, no gradients, no blur, no anti-aliasing, no dithering, no smooth vector look, same pixel size in every frame

REFERENCE IMAGE LOCK (highest priority): use the provided character reference image as the ground truth for the character's appearance. Match it exactly in every frame — same face, same hair and beard, same body type, same outfit, same accessories, same colors and proportions. Do not redesign or reinterpret the character.

FRAME VARIATION RULE (critical): every frame MUST be a visibly different drawing with a clearly different leg and arm silhouette — never duplicate, copy-paste, mirror or lightly trace one frame to make the next.

Character (identical in every frame, always facing right): average height bald man, sturdy average build with broad shoulders, only a very subtle soft midsection (not overweight), fair light skin, smooth bald head with a high rounded forehead, blue-gray eyes, friendly confident smile, short, close-cropped, low-volume beard hugging the jaw and chin (not bushy, not thick), light brown with warm golden tones, dark olive green casual jacket worn open over a plain white t-shirt, dark blue jeans, white sneakers.

Output format: one wide horizontal LANDSCAPE image (16:9 aspect ratio or wider), never portrait or square. Image content: exactly 4 sprites of this character on a plain white background, side by side in ONE single horizontal row (NEVER stacked vertically, never one above another, all sprites aligned on the same horizontal baseline at the same height), clearly separated and never overlapping, every sprite showing the FULL BODY from head to feet, never cropped or clipped at the waist, knees or image edge, nothing else — no text, no labels, no boxes, no scenery. The 4 sprites MUST be in strict chronological order from left to right (frame 1 leftmost, frame 4 rightmost). WALK cycle — a seamless looping walk animation where each frame flows into the next and frame 4 leads smoothly back into frame 1, with legs visibly alternating — do not repeat the same leg position twice: frame 1, right leg stepped fully forward and left leg fully back, left arm swung forward and right arm swung back; frame 2, a passing/mid-stride pose with both legs close together near the middle, transitioning; frame 3, left leg stepped fully forward and right leg fully back (the mirrored opposite of frame 1), right arm swung forward and left arm swung back; frame 4, a passing/mid-stride pose again with both legs close together, transitioning back toward frame 1.
```

---

## 3. ATTACK (ATAQUE) — 4 quadros

```
STYLE LOCK: authentic 2D pixel art in the look of 90s arcade fighting games (Street Fighter Alpha, King of Fighters '98), semi-realistic proportions with a normal-sized head (about 7 heads tall, not chibi, not cartoon), every sprite drawn on a native pixel grid about 96 px tall and upscaled with nearest-neighbor so the square pixels are visible, 1px near-black outline, hard-edged cel shading with exactly 3 tones per material plus one highlight, muted natural colors, no gradients, no blur, no anti-aliasing, no dithering, no smooth vector look, same pixel size in every frame

REFERENCE IMAGE LOCK (highest priority): use the provided character reference image as the ground truth for the character's appearance. Match it exactly in every frame — same face, same hair and beard, same body type, same outfit, same accessories, same colors and proportions. Do not redesign or reinterpret the character.

FRAME VARIATION RULE (critical): every frame MUST be a visibly different drawing with a clearly different silhouette and arm position — the arm MUST visibly travel from pulled back, to halfway, to fully extended; never the same arm pose twice.

Character (identical in every frame, always facing right): average height bald man, sturdy average build with broad shoulders, only a very subtle soft midsection (not overweight), fair light skin, smooth bald head with a high rounded forehead, blue-gray eyes, friendly confident smile, short, close-cropped, low-volume beard hugging the jaw and chin (not bushy, not thick), light brown with warm golden tones, dark olive green casual jacket worn open over a plain white t-shirt, dark blue jeans, white sneakers.

Output format: one wide horizontal LANDSCAPE image (16:9 aspect ratio or wider), never portrait or square. Image content: exactly 4 sprites of this character on a plain white background, side by side in ONE single horizontal row (NEVER stacked vertically, never one above another, all sprites aligned on the same horizontal baseline at the same height), clearly separated and never overlapping, every sprite showing the FULL BODY from head to feet, never cropped or clipped at the waist, knees or image edge, nothing else — no text, no labels, no boxes, no scenery. The 4 sprites MUST be in strict chronological order from left to right: frame 1 (wind-up) leftmost, frame 2 (mid-strike), frame 3 (impact), frame 4 (recovery) rightmost. A single punch with a strong sense of motion: frame 1 wind-up with the right arm pulled back behind the body and torso twisted back, weight shifted onto the back leg; frame 2 mid-strike with the right arm halfway extended forward, torso rotating through the punch, front knee bending forward, a clear sense of forward momentum; frame 3 the right arm fully extended forward in a straight punch at the impact moment, torso fully rotated, back leg straightened; frame 4, the recovery — he pulls the punching arm back toward his guard, exhales and settles his torso and legs back toward the relaxed fighting stance, weight returning to center, a calm follow-through pose that connects smoothly back to the IDLE stance.
```

---

## 4. DEFENSE (DEFESA) — 1 quadro

```
STYLE LOCK: authentic 2D pixel art in the look of 90s arcade fighting games (Street Fighter Alpha, King of Fighters '98), semi-realistic proportions with a normal-sized head (about 7 heads tall, not chibi, not cartoon), every sprite drawn on a native pixel grid about 96 px tall and upscaled with nearest-neighbor so the square pixels are visible, 1px near-black outline, hard-edged cel shading with exactly 3 tones per material plus one highlight, muted natural colors, no gradients, no blur, no anti-aliasing, no dithering, no smooth vector look, same pixel size in every frame

REFERENCE IMAGE LOCK (highest priority): use the provided character reference image as the ground truth for the character's appearance. Match it exactly — same face, same hair and beard, same body type, same outfit, same accessories, same colors and proportions. Do not redesign or reinterpret the character.

Character (always facing right): average height bald man, sturdy average build with broad shoulders, only a very subtle soft midsection (not overweight), fair light skin, smooth bald head with a high rounded forehead, blue-gray eyes, friendly confident smile, short, close-cropped, low-volume beard hugging the jaw and chin (not bushy, not thick), light brown with warm golden tones, dark olive green casual jacket worn open over a plain white t-shirt, dark blue jeans, white sneakers.

Output format: one wide horizontal LANDSCAPE image (16:9 aspect ratio or wider), never portrait or square. Image content: exactly 1 sprite of this character on a plain white background, centered, nothing else — no text, no labels, no boxes, no scenery. Defense pose: both arms raised guarding the face, elbows tucked, weight low and braced with knees bent, body slightly leaned back as if absorbing an incoming hit.
```

---

## 5. SPECIAL (ESPECIAL) — 4 quadros

```
STYLE LOCK: authentic 2D pixel art in the look of 90s arcade fighting games (Street Fighter Alpha, King of Fighters '98), semi-realistic proportions with a normal-sized head (about 7 heads tall, not chibi, not cartoon), every sprite drawn on a native pixel grid about 96 px tall and upscaled with nearest-neighbor so the square pixels are visible, 1px near-black outline, hard-edged cel shading with exactly 3 tones per material plus one highlight, muted natural colors, no gradients, no blur, no anti-aliasing, no dithering, no smooth vector look, same pixel size in every frame

REFERENCE IMAGE LOCK (highest priority): use the provided character reference image as the ground truth for the character's appearance. Match it exactly in every frame — same face, same hair and beard, same body type, same outfit, same accessories, same colors and proportions. Do not redesign or reinterpret the character.

FRAME VARIATION RULE (critical): every frame MUST be a visibly different drawing with a clearly different silhouette — never duplicate, copy-paste, mirror or lightly trace one frame to make the next.

Character (identical in every frame, always facing right): average height bald man, sturdy average build with broad shoulders, only a very subtle soft midsection (not overweight), fair light skin, smooth bald head with a high rounded forehead, blue-gray eyes, friendly confident smile, short, close-cropped, low-volume beard hugging the jaw and chin (not bushy, not thick), light brown with warm golden tones, dark olive green casual jacket worn open over a plain white t-shirt, dark blue jeans, white sneakers.

Output format: one wide horizontal LANDSCAPE image (16:9 aspect ratio or wider), never portrait or square. Image content: exactly 4 sprites of this character on a plain white background, side by side in ONE single horizontal row (NEVER stacked vertically, never one above another, all sprites aligned on the same horizontal baseline at the same height), clearly separated and never overlapping, every sprite showing the FULL BODY from head to feet, never cropped or clipped at the waist, knees or image edge, nothing else — no text, no labels, no boxes, no scenery. The 4 sprites MUST be in strict chronological order from left to right — frame 1 (charging) leftmost, frame 2 (release), frame 3 (full effect), frame 4 (recovery: the effect completely gone, no leftover glow or particles at all, as he eases back toward the relaxed fighting stance) rightmost — with the effect growing visibly bigger from frame 1 to frame 3 and fully gone in frame 4. In every frame, the glowing effect MUST be drawn as solid connected pixel masses with hard clean edges — never scattered specks, floating dust or tiny detached fragments — so the sprites stay easy to cut out from the white background. SPECIAL move sequence — the Joker professor throws an unpredictable barrage mixing large glowing items from EVERY course subject at once: a network cable end, a floppy disk, a sticky note, a kanban card, a code bracket glyph (decorative, no readable text), a database cylinder and a small router fly out together as big solid projectiles, with mixed multicolor pixel effects (cyan, magenta and golden yellow). IMPORTANT: the items MUST be few and large (about five to seven total), flying as ONE tight connected group close in front of him with short solid multicolor trails — never a scattered scene-wide storm of tiny items, no sparkles or dust: frame 1 charging/winding up, arms pulled back, a small solid multicolor glow building close to his hands with the items tucked near him; frame 2 the release, he hurls the tight group of items forward right in front of him as one connected volley; frame 3 the volley at full intensity, the same items slightly farther ahead and glowing brighter, still one tight connected group clearly launched from his hands.
```

---

## 6. ULTIMATE (SUPREMO) — 5 quadros

```
STYLE LOCK: authentic 2D pixel art in the look of 90s arcade fighting games (Street Fighter Alpha, King of Fighters '98), semi-realistic proportions with a normal-sized head (about 7 heads tall, not chibi, not cartoon), every sprite drawn on a native pixel grid about 96 px tall and upscaled with nearest-neighbor so the square pixels are visible, 1px near-black outline, hard-edged cel shading with exactly 3 tones per material plus one highlight, muted natural colors, no gradients, no blur, no anti-aliasing, no dithering, no smooth vector look, same pixel size in every frame

REFERENCE IMAGE LOCK (highest priority): use the provided character reference image as the ground truth for the character's appearance. Match it exactly in every frame — same face, same hair and beard, same body type, same outfit, same accessories, same colors and proportions. Do not redesign or reinterpret the character.

FRAME VARIATION RULE (critical): every frame MUST be a visibly different drawing with a clearly different silhouette — never duplicate, copy-paste, mirror or lightly trace one frame to make the next. This is the cinematic finishing move: poses get progressively bigger and more dramatic.

Character (identical in every frame, always facing right): average height bald man, sturdy average build with broad shoulders, only a very subtle soft midsection (not overweight), fair light skin, smooth bald head with a high rounded forehead, blue-gray eyes, friendly confident smile, short, close-cropped, low-volume beard hugging the jaw and chin (not bushy, not thick), light brown with warm golden tones, dark olive green casual jacket worn open over a plain white t-shirt, dark blue jeans, white sneakers.

Output format: one wide horizontal LANDSCAPE image (16:9 aspect ratio or wider), never portrait or square. Image content: exactly 5 sprites of this character on a plain white background, side by side in ONE single horizontal row (NEVER stacked vertically, never one above another, all sprites aligned on the same horizontal baseline at the same height), clearly separated and never overlapping, every sprite showing the FULL BODY from head to feet, never cropped or clipped at the waist, knees or image edge, nothing else — no text, no labels, no boxes, no scenery. The 5 sprites MUST be arranged in strict chronological order from left to right — frame 1 (charging) leftmost, then frame 2 (summoning), then frame 3 (attack launched), then frame 4 (maximum intensity), then frame 5 (recovery: the effect completely gone, no leftover glow or particles at all, as he eases back toward the relaxed fighting stance) rightmost — and the energy/effect MUST visibly grow bigger and bigger from frame 1 to frame 4 and be fully gone in frame 5, so the sequence order is obvious at a glance. In every frame, the effect MUST be drawn as solid connected pixel masses with hard clean edges — never scattered specks, floating dust or tiny detached fragments — so the sprites stay easy to cut out from the white background. ULTIMATE finishing move called "SURPRISE EXAM" (PROVA SURPRESA) — he hurls a tight burst of flying exam papers and glowing question marks, with mixed multicolor pixel effects (cyan, magenta and golden yellow). IMPORTANT: everything stays compact and connected — about four large exam sheets and two large solid question marks flying as ONE tight connected group in the bounded area right in front of him, with short solid multicolor trails, never a scene-filling vortex or storm, no scattered glitter: frame 1 he crouches low with a mischievous grin, gathering a small solid multicolor glow between both hands with the exam sheets tucked near him; frame 2 he rises and fans the stack of large glowing exam papers upward right in front of him, the solid question marks glowing among them; frame 3 he swings his arms forward and the tight burst of papers and question marks blasts into the bounded zone right in front of him as one connected volley; frame 4 the volley at maximum intensity, the same tight group glowing brighter with one bold solid multicolor impact flash, him braced in a wide stance pushing the attack forward.
```

---

## 7. DOWN (CAÍDO) — 1 quadro

```
STYLE LOCK: authentic 2D pixel art in the look of 90s arcade fighting games (Street Fighter Alpha, King of Fighters '98), semi-realistic proportions with a normal-sized head (about 7 heads tall, not chibi, not cartoon), every sprite drawn on a native pixel grid about 96 px tall and upscaled with nearest-neighbor so the square pixels are visible, 1px near-black outline, hard-edged cel shading with exactly 3 tones per material plus one highlight, muted natural colors, no gradients, no blur, no anti-aliasing, no dithering, no smooth vector look, same pixel size in every frame

REFERENCE IMAGE LOCK (highest priority): use the provided character reference image as the ground truth for the character's appearance. Match it exactly — same face, same hair and beard, same body type, same outfit, same accessories, same colors and proportions. Do not redesign or reinterpret the character.

Character: average height bald man, sturdy average build with broad shoulders, only a very subtle soft midsection (not overweight), fair light skin, smooth bald head with a high rounded forehead, blue-gray eyes, friendly confident smile, short, close-cropped, low-volume beard hugging the jaw and chin (not bushy, not thick), light brown with warm golden tones, dark olive green casual jacket worn open over a plain white t-shirt, dark blue jeans, white sneakers.

Output format: one wide horizontal LANDSCAPE image (16:9 aspect ratio or wider), never portrait or square. Image content: exactly 1 sprite of this character on a plain white background, nothing else — no text, no labels, no boxes, no scenery. Knocked down: lying flat on his back on the ground, head to the left, arms spread loosely at his sides, eyes closed, completely still.
```
