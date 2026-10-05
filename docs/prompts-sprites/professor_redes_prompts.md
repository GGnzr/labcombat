# Professor REDES — prompts divididos por pose

> **Como usar (Google Flow / Whisk):** para cada prompt abaixo, anexe a **imagem do modelo do Professor Redes** como referência de sujeito/personagem e cole o prompt no campo de texto. Gere como **imagem**, uma pose por vez.
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

Character (identical in every frame, always facing right): short stocky bald man, about 1.60 m tall, slightly overweight, thick full black beard with a few gray streaks, black AC/DC band t-shirt with the white AC/DC logo and lightning bolt on the chest, dark jeans, plain sneakers, no wristbands, no headphones, no other accessories.

Output format: one wide horizontal LANDSCAPE image (16:9 aspect ratio or wider), never portrait or square. Image content: exactly 2 sprites of this character on a plain white background, side by side in ONE single horizontal row (NEVER stacked vertically, never one above another, both sprites aligned on the same horizontal baseline at the same height), clearly separated and never overlapping, every sprite showing the FULL BODY from head to feet, never cropped or clipped at the waist, knees or image edge, nothing else — no text, no labels, no boxes, no scenery. The 2 sprites MUST be in chronological order, frame 1 (inhale) on the left and frame 2 (exhale) on the right. IDLE breathing loop — a seamless 2-frame animation cycle: frame 2 must flow naturally back into frame 1 so the loop repeats endlessly without a visual jump: frame 1 relaxed fighting stance with chest slightly raised on an inhale; frame 2 the same stance with chest and shoulders slightly lowered on an exhale, arms hanging a touch lower and knees a touch more bent — a small difference, but the two frames must still be visibly distinguishable drawings, never the exact same sprite duplicated.
```

---

## 2. WALK (ANDAR) — 4 quadros

```
STYLE LOCK: authentic 2D pixel art in the look of 90s arcade fighting games (Street Fighter Alpha, King of Fighters '98), semi-realistic proportions with a normal-sized head (about 7 heads tall, not chibi, not cartoon), every sprite drawn on a native pixel grid about 96 px tall and upscaled with nearest-neighbor so the square pixels are visible, 1px near-black outline, hard-edged cel shading with exactly 3 tones per material plus one highlight, muted natural colors, no gradients, no blur, no anti-aliasing, no dithering, no smooth vector look, same pixel size in every frame

REFERENCE IMAGE LOCK (highest priority): use the provided character reference image as the ground truth for the character's appearance. Match it exactly in every frame — same face, same hair and beard, same body type, same outfit, same accessories, same colors and proportions. Do not redesign or reinterpret the character.

FRAME VARIATION RULE (critical): every frame MUST be a visibly different drawing with a clearly different leg and arm silhouette — never duplicate, copy-paste, mirror or lightly trace one frame to make the next.

Character (identical in every frame, always facing right): short stocky bald man, about 1.60 m tall, slightly overweight, thick full black beard with a few gray streaks, black AC/DC band t-shirt with the white AC/DC logo and lightning bolt on the chest, dark jeans, plain sneakers, no wristbands, no headphones, no other accessories.

Output format: one wide horizontal LANDSCAPE image (16:9 aspect ratio or wider), never portrait or square. Image content: exactly 4 sprites of this character on a plain white background, side by side in ONE single horizontal row (NEVER stacked vertically, never one above another, all sprites aligned on the same horizontal baseline at the same height), clearly separated and never overlapping, every sprite showing the FULL BODY from head to feet, never cropped or clipped at the waist, knees or image edge, nothing else — no text, no labels, no boxes, no scenery. The 4 sprites MUST be in strict chronological order from left to right (frame 1 leftmost, frame 4 rightmost). WALK cycle — a seamless looping walk animation where each frame flows into the next and frame 4 leads smoothly back into frame 1, with legs visibly alternating — do not repeat the same leg position twice: frame 1, right leg stepped fully forward and left leg fully back, left arm swung forward and right arm swung back; frame 2, a passing/mid-stride pose with both legs close together near the middle, transitioning; frame 3, left leg stepped fully forward and right leg fully back (the mirrored opposite of frame 1), right arm swung forward and left arm swung back; frame 4, a passing/mid-stride pose again with both legs close together, transitioning back toward frame 1.
```

---

## 3. ATTACK (ATAQUE) — 4 quadros

```
STYLE LOCK: authentic 2D pixel art in the look of 90s arcade fighting games (Street Fighter Alpha, King of Fighters '98), semi-realistic proportions with a normal-sized head (about 7 heads tall, not chibi, not cartoon), every sprite drawn on a native pixel grid about 96 px tall and upscaled with nearest-neighbor so the square pixels are visible, 1px near-black outline, hard-edged cel shading with exactly 3 tones per material plus one highlight, muted natural colors, no gradients, no blur, no anti-aliasing, no dithering, no smooth vector look, same pixel size in every frame

REFERENCE IMAGE LOCK (highest priority): use the provided character reference image as the ground truth for the character's appearance. Match it exactly in every frame — same face, same hair and beard, same body type, same outfit, same accessories, same colors and proportions. Do not redesign or reinterpret the character.

FRAME VARIATION RULE (critical): every frame MUST be a visibly different drawing with a clearly different silhouette and arm position — the arm MUST visibly travel from pulled back, to halfway, to fully extended; never the same arm pose twice.

Character (identical in every frame, always facing right): short stocky bald man, about 1.60 m tall, slightly overweight, thick full black beard with a few gray streaks, black AC/DC band t-shirt with the white AC/DC logo and lightning bolt on the chest, dark jeans, plain sneakers, no wristbands, no headphones, no other accessories.

Output format: one wide horizontal LANDSCAPE image (16:9 aspect ratio or wider), never portrait or square. Image content: exactly 4 sprites of this character on a plain white background, side by side in ONE single horizontal row (NEVER stacked vertically, never one above another, all sprites aligned on the same horizontal baseline at the same height), clearly separated and never overlapping, every sprite showing the FULL BODY from head to feet, never cropped or clipped at the waist, knees or image edge, nothing else — no text, no labels, no boxes, no scenery. The 4 sprites MUST be in strict chronological order from left to right: frame 1 (wind-up) leftmost, frame 2 (mid-strike), frame 3 (impact), frame 4 (recovery) rightmost. A single punch with a strong sense of motion: frame 1 wind-up with the right arm pulled back behind the body and torso twisted back, weight shifted onto the back leg; frame 2 mid-strike with the right arm halfway extended forward, torso rotating through the punch, front knee bending forward, a clear sense of forward momentum; frame 3 the right arm fully extended forward in a straight punch at the impact moment, torso fully rotated, back leg straightened; frame 4, the recovery — he pulls the punching arm back toward his guard, exhales and settles his torso and legs back toward the relaxed fighting stance, weight returning to center, a calm follow-through pose that connects smoothly back to the IDLE stance.
```

---

## 4. DEFENSE (DEFESA) — 1 quadro

```
STYLE LOCK: authentic 2D pixel art in the look of 90s arcade fighting games (Street Fighter Alpha, King of Fighters '98), semi-realistic proportions with a normal-sized head (about 7 heads tall, not chibi, not cartoon), every sprite drawn on a native pixel grid about 96 px tall and upscaled with nearest-neighbor so the square pixels are visible, 1px near-black outline, hard-edged cel shading with exactly 3 tones per material plus one highlight, muted natural colors, no gradients, no blur, no anti-aliasing, no dithering, no smooth vector look, same pixel size in every frame

REFERENCE IMAGE LOCK (highest priority): use the provided character reference image as the ground truth for the character's appearance. Match it exactly — same face, same hair and beard, same body type, same outfit, same accessories, same colors and proportions. Do not redesign or reinterpret the character.

Character (always facing right): short stocky bald man, about 1.60 m tall, slightly overweight, thick full black beard with a few gray streaks, black AC/DC band t-shirt with the white AC/DC logo and lightning bolt on the chest, dark jeans, plain sneakers, no wristbands, no headphones, no other accessories.

Output format: one wide horizontal LANDSCAPE image (16:9 aspect ratio or wider), never portrait or square. Image content: exactly 1 sprite of this character on a plain white background, centered, nothing else — no text, no labels, no boxes, no scenery. Defense pose: both arms raised guarding the face, elbows tucked, weight low and braced with knees bent, body slightly leaned back as if absorbing an incoming hit.
```

---

## 4B. HIT (LEVANDO GOLPE) — 1 quadro

```
STYLE LOCK: authentic 2D pixel art in the look of 90s arcade fighting games (Street Fighter Alpha, King of Fighters '98), semi-realistic proportions with a normal-sized head (about 7 heads tall, not chibi, not cartoon), every sprite drawn on a native pixel grid about 96 px tall and upscaled with nearest-neighbor so the square pixels are visible, 1px near-black outline, hard-edged cel shading with exactly 3 tones per material plus one highlight, muted natural colors, no gradients, no blur, no anti-aliasing, no dithering, no smooth vector look, same pixel size in every frame

REFERENCE IMAGE LOCK (highest priority): use the provided character reference image as the ground truth for the character's appearance. Match it exactly — same face, same hair and beard, same body type, same outfit, same accessories, same colors and proportions. Do not redesign or reinterpret the character.

Character (always facing right): short stocky bald man, about 1.60 m tall, slightly overweight, thick full black beard with a few gray streaks, black AC/DC band t-shirt with the white AC/DC logo and lightning bolt on the chest, dark jeans, plain sneakers, no wristbands, no headphones, no other accessories.

Output format: one wide horizontal LANDSCAPE image (16:9 aspect ratio or wider), never portrait or square. Image content: exactly 1 sprite of this character on a plain white background, centered, nothing else — no text, no labels, no boxes, no scenery. Hit reaction — the moment he takes a punch to the torso/face: torso jolted violently backward, head snapped back and slightly to the left, face grimacing in pain (eyes squeezed shut or wide, mouth open), both arms flailing loosely up and away from the body, back leg dragging with the front foot lifting slightly off the ground, the whole silhouette clearly off-balance and reeling. ONE small solid impact star burst (4-point star) drawn as a single solid self-contained pixel mass at the point of contact near his chest or jaw — never scattered sparks, dust or detached fragments.
```

---

## 5. SPECIAL (ESPECIAL) — 3 quadros + projétil separado

```
STYLE LOCK: authentic 2D pixel art in the look of 90s arcade fighting games (Street Fighter Alpha, King of Fighters '98), semi-realistic proportions with a normal-sized head (about 7 heads tall, not chibi, not cartoon), every sprite drawn on a native pixel grid about 96 px tall and upscaled with nearest-neighbor so the square pixels are visible, 1px near-black outline, hard-edged cel shading with exactly 3 tones per material plus one highlight, muted natural colors, no gradients, no blur, no anti-aliasing, no dithering, no smooth vector look, same pixel size in every frame

REFERENCE IMAGE LOCK (highest priority): use the provided character reference image as the ground truth for the character's appearance. Match it exactly in every frame — same face, same hair and beard, same body type, same outfit, same accessories, same colors and proportions. Do not redesign or reinterpret the character.

FRAME VARIATION RULE (critical): every frame MUST be a visibly different drawing with a clearly different silhouette — never duplicate, copy-paste, mirror or lightly trace one frame to make the next.

Character (identical in every frame, always facing right): short stocky bald man, about 1.60 m tall, slightly overweight, thick full black beard with a few gray streaks, black AC/DC band t-shirt with the white AC/DC logo and lightning bolt on the chest, dark jeans, plain sneakers, no wristbands, no headphones, no other accessories.

Output format: ONE wide horizontal LANDSCAPE canvas (16:9 aspect ratio or wider) containing TWO clearly separated parts: on the LEFT, a sprite strip of exactly 3 full-body sprites of this character on a plain white background, side by side in ONE single horizontal row (NEVER stacked vertically, never one above another, all sprites aligned on the same horizontal baseline at the same height), clearly separated and never overlapping, every sprite showing the FULL BODY from head to feet, never cropped or clipped at the waist, knees or image edge; and on the RIGHT, after a wide clear gap of empty white space, ONE isolated projectile sprite ALONE — the cyan wifi orb by itself, no character, no hands, nothing around it. Nothing else on the canvas — no text, no labels, no boxes, no scenery. The 3 character sprites MUST be in strict chronological order from left to right — frame 1 (channeling) leftmost, frame 2 (preparing), frame 3 (firing) rightmost. The character appears EXACTLY ONCE per frame — never duplicated, never drawn twice, never repeated inside the projectile or any effect. In every frame the energy effects MUST be drawn as solid self-contained pixel masses with hard clean edges — never scattered specks, floating dust or tiny detached fragments — so the sprites stay easy to cut out from the white background. SPECIAL move — a HADOUKEN-style energy blast themed after NETWORKING, performed with GRUMPY SYSADMIN personality. The projectile is ONE solid glowing cyan energy orb with a small solid wifi-signal arc motif embossed on it, drawn as a single solid self-contained pixel mass with hard clean edges. Facial expression LOCK: the SAME calm focused fighting expression in all 3 frames — concentrated eyes locked on the target ahead, brows firm, jaw set, slight determined frown, mouth closed or barely open — no smiling, no laughing, no exaggerated reactions, no expression change between frames. FACIAL EXPRESSION LOCK (critical, overrides everything else): in all 3 frames the face is EXACTLY THE SAME — copy the face from the provided reference image identically onto every frame: same calm concentrated fighting expression, eyes locked on the target ahead, brows firm, jaw set, slight determined frown, mouth closed or barely open. Absolutely NO expression change between frames — no anger, no sadness, no tiredness, no happiness, no smiling, no laughing, no squinting, no screaming, no raised eyebrows, no squinted eyes. The personality of the move is shown ONLY through body poses and hand gestures, NEVER through the face. Sequence: frame 1 channeling — he crouches low, one hand tapping his hip where a tool belt would be, the other cupped at his side, a small cyan glow building in his palm, posture of someone thinking 'have you tried turning it off and on again'; frame 2 preparing — he rises both hands cupped at his hip cradling the growing orb, thumb flicking an imaginary router reset button, the orb pulsing in sync with the tap; frame 3 firing — he shoves both palms forward with a sharp exhale, the orb launching forward with a single short solid trail behind it. Separate projectile sprite (right side of the canvas): the same cyan wifi orb alone, ONE solid self-contained pixel mass with hard clean edges, centered on the white background, nothing else.
```

---

## 6. ULTIMATE (SUPREMO) — 3 quadros + projétil separado (especial turbinado)

```
STYLE LOCK: authentic 2D pixel art in the look of 90s arcade fighting games (Street Fighter Alpha, King of Fighters '98), semi-realistic proportions with a normal-sized head (about 7 heads tall, not chibi, not cartoon), every sprite drawn on a native pixel grid about 96 px tall and upscaled with nearest-neighbor so the square pixels are visible, 1px near-black outline, hard-edged cel shading with exactly 3 tones per material plus one highlight, muted natural colors, no gradients, no blur, no anti-aliasing, no dithering, no smooth vector look, same pixel size in every frame

REFERENCE IMAGE LOCK (highest priority): use the provided character reference image as the ground truth for the character's appearance. Match it exactly in every frame — same face, same hair and beard, same body type, same outfit, same accessories, same colors and proportions. Do not redesign or reinterpret the character.

FRAME VARIATION RULE (critical): every frame MUST be a visibly different drawing with a clearly different silhouette — never duplicate, copy-paste, mirror or lightly trace one frame to make the next. This is the cinematic finishing move: poses get progressively bigger and more dramatic.

Character (identical in every frame, always facing right): short stocky bald man, about 1.60 m tall, slightly overweight, thick full black beard with a few gray streaks, black AC/DC band t-shirt with the white AC/DC logo and lightning bolt on the chest, dark jeans, plain sneakers, no wristbands, no headphones, no other accessories.

Output format: ONE wide horizontal LANDSCAPE canvas (16:9 aspect ratio or wider) containing TWO clearly separated parts: on the LEFT, a sprite strip of exactly 3 full-body sprites of this character on a plain white background, side by side in ONE single horizontal row (NEVER stacked vertically, never one above another, all sprites aligned on the same horizontal baseline at the same height), clearly separated and never overlapping, every sprite showing the FULL BODY from head to feet, never cropped or clipped at the waist, knees or image edge; and on the RIGHT, after a wide clear gap of empty white space, ONE isolated projectile sprite ALONE — the giant enhanced cyan wifi orb by itself, no character, no hands, nothing around it. Nothing else on the canvas — no text, no labels, no boxes, no scenery. The 3 character sprites MUST be in strict chronological order from left to right — frame 1 (channeling) leftmost, frame 2 (preparing), frame 3 (firing) rightmost. The character appears EXACTLY ONCE per frame — never duplicated, never drawn twice, never repeated inside the projectile or any effect. In every frame the energy effects MUST be drawn as solid self-contained pixel masses with hard clean edges — never scattered specks, floating dust or tiny detached fragments — so the sprites stay easy to cut out from the white background. ULTIMATE finishing move — an empowered, clearly upgraded version of his SPECIAL blast themed after NETWORKING — the SAME attack, just much bigger and stronger, never a different kind of move, still performed with GRUMPY SYSADMIN personality. The projectile is ONE solid glowing cyan energy orb with a small solid wifi-signal arc motif embossed on it, but drawn noticeably LARGER than the special orb, wrapped in a bright solid aura shell (one clean solid ring of light around the orb, part of the same mass) with a short solid trailing tail of light, all as ONE solid self-contained pixel mass with hard clean edges. Facial expression LOCK: the SAME calm focused fighting expression in all 3 frames — concentrated eyes locked on the target ahead, brows firm, jaw set, slight determined frown, mouth closed or barely open — no smiling, no laughing, no exaggerated reactions, no expression change between frames. FACIAL EXPRESSION LOCK (critical, overrides everything else): in all 3 frames the face is EXACTLY THE SAME — copy the face from the provided reference image identically onto every frame: same calm concentrated fighting expression, eyes locked on the target ahead, brows firm, jaw set, slight determined frown, mouth closed or barely open. Absolutely NO expression change between frames — no anger, no sadness, no tiredness, no happiness, no smiling, no laughing, no squinting, no screaming, no raised eyebrows, no squinted eyes. The personality of the move is shown ONLY through body poses and hand gestures, NEVER through the face. Sequence: frame 1 channeling — he drops into a low crouch, adjusting invisible glasses, fingers twitching like he's typing tcpdump in the air, a tiny cluster of packets glowing between his palms; frame 2 preparing — he straightens with deliberate slowness, the cluster swelling into a massive orb bigger than his torso, the bright aura shell locking around it like a firewall rule — he taps the side of the orb once: 'acknowledged'; frame 3 firing — he hurls it forward with both hands, the giant orb screaming forward wrapped in its aura, leaving a crisp solid trail — he doesn't flinch, already pulling out an imaginary cable tester. Separate projectile sprite (right side of the canvas): the same giant enhanced cyan wifi orb with its aura shell alone, ONE solid self-contained pixel mass with hard clean edges, centered on the white background, nothing else.
```

---

## 7. DOWN (CAÍDO) — 1 quadro

```
STYLE LOCK: authentic 2D pixel art in the look of 90s arcade fighting games (Street Fighter Alpha, King of Fighters '98), semi-realistic proportions with a normal-sized head (about 7 heads tall, not chibi, not cartoon), every sprite drawn on a native pixel grid about 96 px tall and upscaled with nearest-neighbor so the square pixels are visible, 1px near-black outline, hard-edged cel shading with exactly 3 tones per material plus one highlight, muted natural colors, no gradients, no blur, no anti-aliasing, no dithering, no smooth vector look, same pixel size in every frame

REFERENCE IMAGE LOCK (highest priority): use the provided character reference image as the ground truth for the character's appearance. Match it exactly — same face, same hair and beard, same body type, same outfit, same accessories, same colors and proportions. Do not redesign or reinterpret the character.

Character: short stocky bald man, about 1.60 m tall, slightly overweight, thick full black beard with a few gray streaks, black AC/DC band t-shirt with the white AC/DC logo and lightning bolt on the chest, dark jeans, plain sneakers, no wristbands, no headphones, no other accessories.

Output format: one wide horizontal LANDSCAPE image (16:9 aspect ratio or wider), never portrait or square. Image content: exactly 1 sprite of this character on a plain white background, nothing else — no text, no labels, no boxes, no scenery. Knocked down: lying flat on his back on the ground, head to the left, arms spread loosely at his sides, eyes closed, completely still.
```
