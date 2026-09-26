(function () {
    'use strict';

    const CORE = window.GaiaMapCore;
    if (!CORE) throw new Error('GaiaMapCore must be loaded before gaia-map-generator.js');

    const {HEX_SIZE, SQRT3, MAP_ROTATION} = CORE.constants;
    const IMAGE_BASE = 'doc/gaia/map';
    const TRIANGLE_LABEL_OFFSET = 40;
    const TRIANGLE_LABEL_FONT_SIZE = 9;
    const R2_LIBRARY = window.GAIA_BOARD_LIBRARY || window.GAIA_R2_BOARD_LIBRARY;
    const NS = 'http://www.w3.org/2000/svg';

    const {pixel, placedR2Cells, rotatedBounds} = CORE;
    function rotatePoint(x, y, degrees) {
        const angle = degrees * Math.PI / 180;
        return {
            x: x * Math.cos(angle) - y * Math.sin(angle),
            y: x * Math.sin(angle) + y * Math.cos(angle)
        };
    }
    function appendImage(group, data) {
        const image = document.createElementNS(NS, 'image');
        image.setAttribute('href', `${IMAGE_BASE}/${data.image}`);
        image.setAttribute('x', data.x - data.width / 2);
        image.setAttribute('y', data.y - data.height / 2);
        image.setAttribute('width', data.width);
        image.setAttribute('height', data.height);
        image.setAttribute('preserveAspectRatio', 'xMidYMid meet');
        image.dataset.kind = data.kind;
        image.dataset.number = data.number;
        image.dataset.rotationStep = data.rotationStep;
        image.setAttribute('aria-label', data.label);
        if (data.rotation) image.setAttribute('transform', `rotate(${data.rotation} ${data.x} ${data.y})`);
        group.appendChild(image);
    }
    function appendTriangleLabel(group, sector, slotIndex, x, y) {
        const center = rotatePoint(x, y, MAP_ROTATION);
        const centerDistance = Math.hypot(center.x, center.y) || 1;
        const labelX = center.x + center.x / centerDistance * TRIANGLE_LABEL_OFFSET;
        const labelY = center.y + center.y / centerDistance * TRIANGLE_LABEL_OFFSET;
        const text = document.createElementNS(NS, 'text');
        text.textContent = `${sector.number}-${sector.side}`;
        text.setAttribute('x', labelX);
        text.setAttribute('y', labelY);
        text.setAttribute('text-anchor', 'middle');
        text.setAttribute('dominant-baseline', 'middle');
        text.setAttribute('font-family', 'Nunito, sans-serif');
        text.setAttribute('font-size', TRIANGLE_LABEL_FONT_SIZE);
        text.setAttribute('font-weight', '500');
        text.setAttribute('letter-spacing', '0.4');
        text.setAttribute('fill', '#587b95');
        text.setAttribute('stroke', '#07141b');
        text.setAttribute('stroke-width', '1');
        text.setAttribute('stroke-linejoin', 'round');
        text.setAttribute('paint-order', 'stroke fill');
        text.setAttribute('pointer-events', 'none');
        text.setAttribute('aria-hidden', 'true');
        text.dataset.mapTriangleLabel = sector.number;
        if ([2, 3, 6, 7].includes(slotIndex)) {
            text.setAttribute('transform', `rotate(90 ${labelX} ${labelY})`);
        }
        group.appendChild(text);
    }
    function boardCells(layout) {
        return [
            ...layout.r2.map(sector => ({
                owner: `r2:${sector.number}`,
                cells: placedR2Cells(sector).map(cell => [cell.q, cell.r])
            })),
            ...layout.triangles.map(sector => ({
                owner: `triangle:${sector.number}`,
                cells: sector.cells
            })),
            ...layout.specials.map((sector, index) => ({
                owner: `special:${index}`,
                cells: [[sector.q, sector.r]]
            }))
        ];
    }
    function boardSeamPath(layout) {
        const edges = new Map();
        boardCells(layout).forEach(board => board.cells.forEach(([q, r]) => {
            const center = pixel(q, r);
            const vertices = Array.from({length: 6}, (_, index) => {
                const angle = Math.PI / 3 * index;
                return {
                    x: center.x + HEX_SIZE * Math.cos(angle),
                    y: center.y + HEX_SIZE * Math.sin(angle)
                };
            });
            vertices.forEach((start, index) => {
                const end = vertices[(index + 1) % vertices.length];
                const startKey = `${start.x.toFixed(4)},${start.y.toFixed(4)}`;
                const endKey = `${end.x.toFixed(4)},${end.y.toFixed(4)}`;
                const edgeKey = [startKey, endKey].sort().join('|');
                const edge = edges.get(edgeKey) || {start, end, owners: new Set()};
                edge.owners.add(board.owner);
                edges.set(edgeKey, edge);
            });
        }));
        return [...edges.values()]
            .filter(edge => edge.owners.size > 1)
            .map(edge => `M ${edge.start.x} ${edge.start.y} L ${edge.end.x} ${edge.end.y}`)
            .join(' ');
    }
    function appendBoardSeams(group, layout) {
        const pathData = boardSeamPath(layout);
        if (!pathData) return;
        [
            {stroke: '#07141b', width: 2.2, opacity: 0.88},
            {stroke: '#405c74', width: 1, opacity: 0.95}
        ].forEach(style => {
            const path = document.createElementNS(NS, 'path');
            path.setAttribute('d', pathData);
            path.setAttribute('fill', 'none');
            path.setAttribute('stroke', style.stroke);
            path.setAttribute('stroke-width', style.width);
            path.setAttribute('stroke-opacity', style.opacity);
            path.setAttribute('stroke-linecap', 'round');
            path.setAttribute('vector-effect', 'non-scaling-stroke');
            path.dataset.mapSeam = '';
            path.setAttribute('aria-hidden', 'true');
            group.appendChild(path);
        });
    }
    function render(svg, layout) {
        const group = document.createElementNS(NS, 'g');
        const imageLayer = document.createElementNS(NS, 'g');
        const seamLayer = document.createElementNS(NS, 'g');
        const labelLayer = document.createElementNS(NS, 'g');
        group.setAttribute('transform', `rotate(${MAP_ROTATION})`);
        imageLayer.dataset.mapLayer = 'images';
        seamLayer.dataset.mapLayer = 'seams';
        labelLayer.dataset.mapLayer = 'triangle-labels';
        seamLayer.setAttribute('pointer-events', 'none');
        labelLayer.setAttribute('pointer-events', 'none');
        group.append(imageLayer, seamLayer);
        layout.r2.forEach(sector => {
            const center = pixel(sector.q, sector.r);
            appendImage(imageLayer, {
                kind: 'r2', number: sector.number, image: R2_LIBRARY.boards[sector.number].image,
                x: center.x, y: center.y, width: HEX_SIZE * 8, height: HEX_SIZE * SQRT3 * 5,
                rotation: sector.rotation * 60, rotationStep: sector.rotation,
                label: `R2 板块 ${sector.number.padStart(2, '0')}，旋转 ${sector.rotation * 60}度`
            });
        });
        layout.triangles.forEach((sector, slotIndex) => {
            const centers = sector.cells.map(([q, r]) => pixel(q, r));
            const x = centers.reduce((sum, point) => sum + point.x, 0) / centers.length;
            const y = centers.reduce((sum, point) => sum + point.y, 0) / centers.length;
            appendImage(imageLayer, {
                kind: 'triangle', number: sector.number, image: `${sector.number}-${sector.side}.png`,
                x, y, width: HEX_SIZE * SQRT3 * 2 * 370 / 328, height: HEX_SIZE * SQRT3 * 2,
                rotation: sector.baseRotation + sector.rotation * 120, rotationStep: sector.rotation,
                label: `三角板 ${sector.number}，${sector.side}，旋转 ${sector.rotation * 120}度`
            });
            appendTriangleLabel(labelLayer, sector, slotIndex, x, y);
        });
        layout.specials.forEach(sector => {
            const center = pixel(sector.q, sector.r);
            appendImage(imageLayer, {
                kind: 'special', number: sector.image.replace('.png', ''), image: sector.image,
                x: center.x, y: center.y, width: HEX_SIZE * SQRT3, height: HEX_SIZE * 2,
                rotation: 90, rotationStep: 0, label: `特殊板块 ${sector.image.replace('.png', '')}`
            });
        });
        appendBoardSeams(seamLayer, layout);
        svg.replaceChildren(group, labelLayer);
        const bounds = rotatedBounds(layout);
        const padding = 18;
        svg.setAttribute('viewBox', `${bounds.minX-padding} ${bounds.minY-padding} ${bounds.maxX-bounds.minX+padding*2} ${bounds.maxY-bounds.minY+padding*2}`);
        svg.setAttribute('aria-label', `随机地图：10 个 R2 板块、8 个三角板块和 10 个特殊板块`);
    }
    window.GaiaMapGenerator = {generate: CORE.generate, render, validate: CORE.validate};
})();
