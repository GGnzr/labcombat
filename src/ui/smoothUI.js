import Phaser from 'phaser';
import { SoundManager } from '../audio/SoundManager.js';

/**
 * Utilitário para desenhar retângulos com cantos arredondados (Rounded Rectangles)
 * em qualquer objeto Graphics do Phaser 3.
 */
export function drawRoundedRect(gfx, x, y, width, height, radius = 12, fillColor = null, fillAlpha = 1, strokeColor = null, strokeWidth = 0, strokeAlpha = 1) {
    if (fillColor !== null && fillColor !== undefined) {
        gfx.fillStyle(fillColor, fillAlpha);
        gfx.fillRoundedRect(x, y, width, height, radius);
    }
    if (strokeColor !== null && strokeColor !== undefined && strokeWidth > 0) {
        gfx.lineStyle(strokeWidth, strokeColor, strokeAlpha);
        gfx.strokeRoundedRect(x, y, width, height, radius);
    }
}

/**
 * Cria um Card com cantos arredondados modernos (Glassmorphic / Cyberpunk)
 */
export function createSmoothCard(scene, x, y, width, height, options = {}) {
    const {
        radius = 16,
        fillColor = 0x242a35,
        fillAlpha = 0.96,
        strokeColor = 0x475569,
        strokeWidth = 1.5,
        strokeAlpha = 1,
        interactive = false
    } = options;

    const container = scene.add.container(x, y);
    const gfx = scene.add.graphics();
    container.add(gfx);

    let curWidth = width;
    let curHeight = height;
    let curRadius = radius;
    let curFillColor = fillColor;
    let curFillAlpha = fillAlpha;
    let curStrokeColor = strokeColor;
    let curStrokeWidth = strokeWidth;
    let curStrokeAlpha = strokeAlpha;

    const render = (fColor = curFillColor, fAlpha = curFillAlpha, sColor = curStrokeColor, sWidth = curStrokeWidth, sAlpha = curStrokeAlpha, rad = curRadius) => {
        curFillColor = fColor;
        curFillAlpha = fAlpha;
        curStrokeColor = sColor;
        curStrokeWidth = sWidth;
        curStrokeAlpha = sAlpha;
        curRadius = rad;
        gfx.clear();
        drawRoundedRect(gfx, -curWidth / 2, -curHeight / 2, curWidth, curHeight, rad, fColor, fAlpha, sColor, sWidth, sAlpha);
    };

    render();

    container.gfx = gfx;
    container.cardWidth = curWidth;
    container.cardHeight = curHeight;
    container.cardRadius = curRadius;
    container.setCardStyle = render;

    // Métodos de compatibilidade com Phaser Shape (ex: setFillStyle, setStrokeStyle)
    container.setFillStyle = (color, alpha = curFillAlpha) => {
        let col = color;
        if (typeof col === 'string') {
            if (col.startsWith('#')) col = parseInt(col.replace('#', '0x'), 16);
            else if (col.startsWith('0x')) col = parseInt(col, 16);
        }
        render(col, alpha, curStrokeColor, curStrokeWidth, curStrokeAlpha, curRadius);
        return container;
    };

    container.setStrokeStyle = (w, color, alpha = curStrokeAlpha) => {
        let col = color;
        if (typeof col === 'string') {
            if (col.startsWith('#')) col = parseInt(col.replace('#', '0x'), 16);
            else if (col.startsWith('0x')) col = parseInt(col, 16);
        }
        render(curFillColor, curFillAlpha, col, w, alpha, curRadius);
        return container;
    };

    container.setOrigin = () => container;

    if (interactive) {
        container.setSize(width, height);
        container.setInteractive({ useHandCursor: true });
    }

    return container;
}

/**
 * Cria um Botão com cantos arredondados, cores suaves e animações de hover
 */
export function createSmoothButton(scene, x, y, width, height, text, options = {}) {
    const {
        radius = Math.min(Math.round(height / 2), 18),
        fillColor = 0x2d3544,
        fillAlpha = 0.95,
        strokeColor = 0x475569,
        strokeWidth = 1.5,
        hoverFillColor = 0x374151,
        hoverStrokeColor = 0x94a3b8,
        fontSize = '13px',
        textColor = '#f8fafc',
        fontStyle = 'bold',
        fontFamily = 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif, "Segoe UI Emoji"',
        onClick = null
    } = options;

    const container = scene.add.container(x, y);
    const gfx = scene.add.graphics();
    container.add(gfx);

    let curWidth = width;
    let curHeight = height;
    let curFillColor = fillColor;
    let curStrokeColor = strokeColor;
    let curHoverFillColor = hoverFillColor;
    let curHoverStrokeColor = hoverStrokeColor;
    let isHovered = false;
    let isBtnEnabled = true;

    const renderBg = (fColor, fAlpha, sColor, sWidth) => {
        gfx.clear();
        drawRoundedRect(gfx, -curWidth / 2, -curHeight / 2, curWidth, curHeight, radius, fColor, fAlpha, sColor, sWidth);
    };

    renderBg(curFillColor, fillAlpha, curStrokeColor, strokeWidth);

    const label = scene.add.text(0, 0, text, {
        fontSize,
        fill: textColor,
        fontStyle,
        fontFamily,
        align: 'center',
        resolution: 2
    }).setOrigin(0.5);
    container.add(label);

    container.setSize(curWidth, curHeight);
    container.setInteractive({ useHandCursor: true });

    container.on('pointerover', () => {
        if (!isBtnEnabled) return;
        SoundManager.playHover();
        isHovered = true;
        renderBg(curHoverFillColor, fillAlpha, curHoverStrokeColor, strokeWidth + 0.5);
        scene.tweens.add({ targets: container, scaleX: 1.03, scaleY: 1.03, duration: 100, ease: 'Power1' });
    });

    container.on('pointerout', () => {
        if (!isBtnEnabled) return;
        isHovered = false;
        renderBg(curFillColor, fillAlpha, curStrokeColor, strokeWidth);
        scene.tweens.add({ targets: container, scaleX: 1.0, scaleY: 1.0, duration: 100, ease: 'Power1' });
    });

    if (onClick) {
        container.on('pointerdown', () => {
            if (isBtnEnabled) {
                SoundManager.playClick();
                onClick();
            }
        });
    }

    container.label = label;
    container.gfx = gfx;
    container.btnWidth = curWidth;
    container.btnHeight = curHeight;

    // Métodos de compatibilidade
    container.setOrigin = () => container;

    container.setText = (newText) => {
        label.setText(newText);
        return container;
    };

    container.setColors = (normalFill, normalStroke, hFill, hStroke) => {
        if (normalFill !== undefined && normalFill !== null) curFillColor = normalFill;
        if (normalStroke !== undefined && normalStroke !== null) curStrokeColor = normalStroke;
        if (hFill !== undefined && hFill !== null) curHoverFillColor = hFill;
        if (hStroke !== undefined && hStroke !== null) curHoverStrokeColor = hStroke;

        const curFill = isHovered ? curHoverFillColor : curFillColor;
        const curStroke = isHovered ? curHoverStrokeColor : curStrokeColor;
        renderBg(curFill, fillAlpha, curStroke, strokeWidth);
        return container;
    };

    container.setStyle = (styleObj) => {
        if (!styleObj) return container;
        if (styleObj.fill) label.setStyle({ fill: styleObj.fill });
        if (styleObj.fontStyle) label.setStyle({ fontStyle: styleObj.fontStyle });
        if (styleObj.fontSize) label.setStyle({ fontSize: styleObj.fontSize });
        if (styleObj.backgroundColor) {
            let col = styleObj.backgroundColor;
            if (typeof col === 'string') {
                if (col.startsWith('#')) col = parseInt(col.replace('#', '0x'), 16);
                else if (col.startsWith('0x')) col = parseInt(col, 16);
            }
            if (typeof col === 'number') {
                curFillColor = col;
                renderBg(col, fillAlpha, curStrokeColor, strokeWidth);
            }
        }
        if (styleObj.fixedWidth && styleObj.fixedWidth !== curWidth) {
            curWidth = styleObj.fixedWidth;
            container.btnWidth = curWidth;
            container.setSize(curWidth, curHeight);
            renderBg(curFillColor, fillAlpha, curStrokeColor, strokeWidth);
        }
        return container;
    };

    container.setEnabled = (enabled) => {
        isBtnEnabled = enabled;
        container.setAlpha(enabled ? 1 : 0.5);
        if (container.input) container.input.enabled = enabled;
        if (!enabled) {
            renderBg(curFillColor, fillAlpha, curStrokeColor, strokeWidth);
            container.setScale(1.0);
        }
        return container;
    };

    return container;
}

/**
 * Cria um Banner / Badge informativo com cantos arredondados automáticos
 */
export function createSmoothBanner(scene, x, y, text = '', options = {}) {
    const {
        radius = 14,
        fillColor = 0x242a35,
        fillAlpha = 0.95,
        strokeColor = 0x475569,
        strokeWidth = 1.5,
        fontSize = '12px',
        textColor = '#f8fafc',
        fontStyle = 'bold',
        fontFamily = 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif, "Segoe UI Emoji"',
        paddingX = 20,
        paddingY = 8,
        align = 'center',
        lineSpacing = 4
    } = options;

    const container = scene.add.container(x, y);
    const gfx = scene.add.graphics();
    container.add(gfx);

    let curFillColor = fillColor;
    let curStrokeColor = strokeColor;

    const label = scene.add.text(0, 0, text, {
        fontSize,
        fill: textColor,
        fontStyle,
        fontFamily,
        align,
        lineSpacing,
        resolution: 2
    }).setOrigin(0.5);
    container.add(label);

    const updateBg = () => {
        gfx.clear();
        if (!label.text || label.text.trim() === '') return;
        const w = label.width + paddingX * 2;
        const h = label.height + paddingY * 2;
        drawRoundedRect(gfx, -w / 2, -h / 2, w, h, radius, curFillColor, fillAlpha, curStrokeColor, strokeWidth);
        container.setSize(w, h);
    };

    if (text) updateBg();

    container.label = label;
    container.gfx = gfx;
    container.setOrigin = () => container;

    container.setText = (newText) => {
        label.setText(newText);
        updateBg();
        return container;
    };

    container.setStyle = (styleObj) => {
        if (!styleObj) return container;
        if (styleObj.fill) label.setStyle({ fill: styleObj.fill });
        if (styleObj.fontSize) label.setStyle({ fontSize: styleObj.fontSize });
        if (styleObj.align) label.setStyle({ align: styleObj.align });
        if (styleObj.lineSpacing) label.setStyle({ lineSpacing: styleObj.lineSpacing });
        if (styleObj.backgroundColor) {
            let col = styleObj.backgroundColor;
            if (typeof col === 'string') {
                if (col.startsWith('#')) col = parseInt(col.replace('#', '0x'), 16);
                else if (col.startsWith('0x')) col = parseInt(col, 16);
            }
            if (typeof col === 'number') curFillColor = col;
        }
        updateBg();
        return container;
    };

    return container;
}
