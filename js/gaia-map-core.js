(function () {
    'use strict';

    const R2_LIBRARY = window.GAIA_BOARD_LIBRARY || window.GAIA_R2_BOARD_LIBRARY;
    if (!R2_LIBRARY) throw new Error('GAIA_BOARD_LIBRARY must be loaded before gaia-map-core.js');

    const HEX_SIZE = 18;
    const SQRT3 = Math.sqrt(3);
    const MAP_ROTATION = 30;
    const R2_POSITIONS = [[0,0],[5,-4],[-5,4],[-1,5],[4,1],[9,-3],[10,-8],[6,-9],[1,-5],[-4,-1]];
    const TRIANGLE_SLOTS = [
        {cells:[[-2,-4],[-3,-4],[-2,-5]],baseRotation:180},
        {cells:[[3,-8],[2,-8],[3,-9]],baseRotation:180},
        {cells:[[12,-6],[11,-6],[12,-7]],baseRotation:180},
        {cells:[[9,-10],[9,-11],[10,-11]],baseRotation:0},
        {cells:[[7,1],[7,0],[8,0]],baseRotation:0},
        {cells:[[2,5],[2,4],[3,4]],baseRotation:0},
        {cells:[[-5,7],[-4,6],[-4,7]],baseRotation:180},
        {cells:[[-7,3],[-7,2],[-6,2]],baseRotation:0}
    ];
    const SPECIAL_CELLS = [[-3,1],[-2,3],[1,2],[-1,-2],[3,-1],[6,-2],[8,-5],[7,-7],[4,-6],[2,-3]];
    const FLEET_IMAGES = ['舰队-VK.png','舰队-拓邦.png','舰队-永恒盖亚.png','舰队-鹦鹉螺.png'];
    const OTHER_SPECIAL_IMAGES = ['源行星.png','小行星.png','小行星.png','小行星.png','小行星.png','空.png'];
    const DIRECTIONS = [[1,0],[1,-1],[0,-1],[-1,0],[-1,1],[0,1]];

    function key(q, r) { return `${q},${r}`; }
    function distance(q, r) { return Math.max(Math.abs(q), Math.abs(r), Math.abs(-q-r)); }
    function pixel(q, r) { return {x: HEX_SIZE * 1.5 * q, y: HEX_SIZE * SQRT3 * (r + q / 2)}; }
    function shuffle(items) {
        const result = [...items];
        for (let i = result.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [result[i], result[j]] = [result[j], result[i]];
        }
        return result;
    }
    function radiusKeys(radius) {
        const result = [];
        for (let q = -radius; q <= radius; q++) {
            const minR = Math.max(-radius, -q - radius);
            const maxR = Math.min(radius, -q + radius);
            for (let r = minR; r <= maxR; r++) result.push(key(q, r));
        }
        return result;
    }
    function rotateAxial(q, r, steps) {
        let rotatedQ = q;
        let rotatedR = r;
        for (let i = 0; i < ((steps % 6) + 6) % 6; i++) {
            [rotatedQ, rotatedR] = [-rotatedR, rotatedQ + rotatedR];
        }
        return [rotatedQ, rotatedR];
    }
    function placedR2Cells(sector) {
        const board = R2_LIBRARY.boards[sector.number];
        return radiusKeys(2).map(localKey => {
            const [localQ, localR] = localKey.split(',').map(Number);
            const [rotatedQ, rotatedR] = rotateAxial(localQ, localR, sector.rotation || 0);
            const q = sector.q + rotatedQ;
            const r = sector.r + rotatedR;
            const cellType = board.cellAnnotations[localKey] || null;
            return {
                q,
                r,
                worldQ: q,
                worldR: r,
                worldKey: key(q, r),
                localQ,
                localR,
                cellType,
                planet: R2_LIBRARY.standardPlanetTypes.includes(cellType) ? cellType : null,
                boardNumber: sector.number
            };
        });
    }
    function placedTriangleCells(sector) {
        const board = R2_LIBRARY.triangleBoards?.[String(sector.number)]?.[sector.side];
        const centers = sector.cells.map(([q, r]) => ({q, r, ...pixel(q, r)}));
        const centerX = centers.reduce((sum, point) => sum + point.x, 0) / centers.length;
        const centerY = centers.reduce((sum, point) => sum + point.y, 0) / centers.length;
        const rotation = (Number(sector.baseRotation) || 0) + (Number(sector.rotation) || 0) * 120;
        const inverseAngle = -rotation * Math.PI / 180;
        return centers.map(point => {
            const dx = point.x - centerX;
            const dy = point.y - centerY;
            const localX = dx * Math.cos(inverseAngle) - dy * Math.sin(inverseAngle);
            const localY = dx * Math.sin(inverseAngle) + dy * Math.cos(inverseAngle);
            const angle = (Math.round(Math.atan2(localY, localX) * 180 / Math.PI / 120) * 120 + 360) % 360;
            const cellType = board?.cellAnnotations?.[String(angle)] || null;
            return {
                q: point.q,
                r: point.r,
                worldQ: point.q,
                worldR: point.r,
                worldKey: key(point.q, point.r),
                localAngle: angle,
                cellType,
                boardNumber: String(sector.number),
                boardSide: sector.side
            };
        });
    }
    function specialCellType(imageName) {
        return R2_LIBRARY.specialBoards?.[imageName]?.cellAnnotation || null;
    }
    function planetConflicts(sectors) {
        const planets = new Map();
        sectors.forEach(sector => placedR2Cells(sector).forEach(cell => {
            if (cell.planet) planets.set(cell.worldKey, cell);
        }));
        const conflicts = [];
        planets.forEach(cell => DIRECTIONS.forEach(([dq, dr]) => {
            const neighbor = planets.get(key(cell.q + dq, cell.r + dr));
            if (neighbor && neighbor.planet === cell.planet && cell.worldKey < neighbor.worldKey) {
                conflicts.push({first: cell, second: neighbor, planet: cell.planet});
            }
        }));
        return conflicts;
    }
    function rerollConflicts(sectors, maxPasses = 180) {
        for (let pass = 0; pass < maxPasses; pass++) {
            const conflicts = planetConflicts(sectors);
            if (!conflicts.length) return true;
            const boards = new Set(conflicts.flatMap(conflict => [conflict.first.boardNumber, conflict.second.boardNumber]));
            sectors.forEach(sector => {
                if (!boards.has(sector.number)) return;
                const choices = [0,1,2,3,4,5].filter(rotation => rotation !== sector.rotation);
                sector.rotation = choices[Math.floor(Math.random() * choices.length)];
            });
        }
        return false;
    }
    function solveRotations(sectors) {
        const assigned = new Map();
        const degree = index => R2_POSITIONS.reduce((total, position, other) => {
            if (index === other) return total;
            return total + (distance(R2_POSITIONS[index][0] - position[0], R2_POSITIONS[index][1] - position[1]) === 5 ? 1 : 0);
        }, 0);
        const order = sectors.map((_, index) => index).sort((a, b) => degree(b) - degree(a));
        function canPlace(cells) {
            return cells.every(cell => DIRECTIONS.every(([dq, dr]) => assigned.get(key(cell.q + dq, cell.r + dr)) !== cell.planet));
        }
        function place(position) {
            if (position === order.length) return true;
            const sector = sectors[order[position]];
            for (const rotation of shuffle([0,1,2,3,4,5])) {
                sector.rotation = rotation;
                const planets = placedR2Cells(sector).filter(cell => cell.planet);
                if (!canPlace(planets)) continue;
                planets.forEach(cell => assigned.set(cell.worldKey, cell.planet));
                if (place(position + 1)) return true;
                planets.forEach(cell => assigned.delete(cell.worldKey));
            }
            return false;
        }
        return place(0);
    }
    function createR2Layout() {
        for (let attempt = 0; attempt < 120; attempt++) {
            const central = shuffle(['1','2','3','4']).slice(0, 2);
            const remaining = shuffle(['1','2','3','4','5','6','7','8','9','10'].filter(number => !central.includes(number)));
            const numbers = [...shuffle(central), ...remaining];
            const sectors = numbers.map((number, index) => ({
                number,
                q: R2_POSITIONS[index][0],
                r: R2_POSITIONS[index][1],
                rotation: Math.floor(Math.random() * 6)
            }));
            if (!rerollConflicts(sectors) && !solveRotations(sectors)) continue;
            if (!planetConflicts(sectors).length) return sectors;
        }
        throw new Error('无法生成合规的 R2 板块布局');
    }
    function createTriangleLayout() {
        return shuffle(['11','12','13','14','15','16','17','18']).map((number, index) => ({
            number,
            cells: TRIANGLE_SLOTS[index].cells.map(cell => [...cell]),
            side: Math.random() < 0.5 ? '实心' : '空心',
            rotation: Math.floor(Math.random() * 3),
            baseRotation: TRIANGLE_SLOTS[index].baseRotation
        }));
    }
    function createSpecialLayout() {
        const combinations = [];
        for (let a = 0; a < SPECIAL_CELLS.length; a++) {
            for (let b = a + 1; b < SPECIAL_CELLS.length; b++) {
                for (let c = b + 1; c < SPECIAL_CELLS.length; c++) {
                    for (let d = c + 1; d < SPECIAL_CELLS.length; d++) {
                        const indexes = [a,b,c,d];
                        if (indexes.every((value, index) => indexes.slice(index + 1).every(other => {
                            const first = SPECIAL_CELLS[value];
                            const second = SPECIAL_CELLS[other];
                            return distance(first[0] - second[0], first[1] - second[1]) > 3;
                        }))) combinations.push(indexes);
                    }
                }
            }
        }
        const fleetIndexes = new Set(combinations[Math.floor(Math.random() * combinations.length)]);
        const fleets = shuffle(FLEET_IMAGES);
        const others = shuffle(OTHER_SPECIAL_IMAGES);
        let fleetCursor = 0;
        let otherCursor = 0;
        return SPECIAL_CELLS.map(([q, r], index) => ({
            q,
            r,
            image: fleetIndexes.has(index) ? fleets[fleetCursor++] : others[otherCursor++]
        }));
    }
    function usedCoordinates(layout) {
        const used = new Map();
        layout.r2.forEach(sector => placedR2Cells(sector).forEach(cell => used.set(cell.worldKey, [cell.q, cell.r])));
        layout.triangles.forEach(sector => sector.cells.forEach(([q, r]) => used.set(key(q, r), [q, r])));
        layout.specials.forEach(cell => used.set(key(cell.q, cell.r), [cell.q, cell.r]));
        return [...used.values()];
    }
    function rotatedBounds(layout) {
        const angle = MAP_ROTATION * Math.PI / 180;
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);
        let minX = Infinity;
        let minY = Infinity;
        let maxX = -Infinity;
        let maxY = -Infinity;
        usedCoordinates(layout).forEach(([q, r]) => {
            const center = pixel(q, r);
            for (let i = 0; i < 6; i++) {
                const vertexAngle = Math.PI / 180 * i * 60;
                const x = center.x + HEX_SIZE * Math.cos(vertexAngle);
                const y = center.y + HEX_SIZE * Math.sin(vertexAngle);
                const rotatedX = x * cos - y * sin;
                const rotatedY = x * sin + y * cos;
                minX = Math.min(minX, rotatedX);
                minY = Math.min(minY, rotatedY);
                maxX = Math.max(maxX, rotatedX);
                maxY = Math.max(maxY, rotatedY);
            }
        });
        return {minX, minY, maxX, maxY};
    }
    function compactLayout(layout) {
        return {
            version: 2,
            generatedAt: layout.generatedAt || null,
            r2: layout.r2.map(sector => ({number: String(sector.number), rotation: Number(sector.rotation)})),
            triangles: layout.triangles.map(sector => ({number: String(sector.number), side: sector.side, rotation: Number(sector.rotation || 0)}))
        };
    }
    function specialsToRecord(specials) {
        return Object.fromEntries(specials.map(cell => [key(cell.q, cell.r), cell.image]));
    }
    function specialsFromRecord(record) {
        return SPECIAL_CELLS.map(([q, r]) => ({q, r, image: record?.[key(q, r)]}));
    }
    function expandCompactLayout(layout, specials = []) {
        return {
            version: 1,
            generatedAt: layout.generatedAt || null,
            r2: layout.r2.map((sector, index) => ({
                number: String(sector.number),
                q: R2_POSITIONS[index][0],
                r: R2_POSITIONS[index][1],
                rotation: Number(sector.rotation)
            })),
            triangles: layout.triangles.map((sector, index) => ({
                number: String(sector.number),
                cells: TRIANGLE_SLOTS[index].cells.map(cell => [...cell]),
                side: sector.side,
                rotation: Number(sector.rotation || 0),
                baseRotation: TRIANGLE_SLOTS[index].baseRotation
            })),
            specials: specials.map(cell => ({q: Number(cell.q), r: Number(cell.r), image: cell.image}))
        };
    }
    function validateCompactLayout(layout) {
        if (!layout || !Array.isArray(layout.r2) || layout.r2.length !== 10 || !Array.isArray(layout.triangles) || layout.triangles.length !== 8) return false;
        const r2Numbers = layout.r2.map(item => String(item.number));
        const triangleNumbers = layout.triangles.map(item => String(item.number));
        if (new Set(r2Numbers).size !== 10 || r2Numbers.some(number => !R2_LIBRARY.boards[number])) return false;
        if (!layout.r2.every(item => Number.isInteger(Number(item.rotation)) && Number(item.rotation) >= 0 && Number(item.rotation) <= 5)) return false;
        if (!r2Numbers.slice(0, 2).every(number => ['1','2','3','4'].includes(number))) return false;
        if (new Set(triangleNumbers).size !== 8 || triangleNumbers.some(number => Number(number) < 11 || Number(number) > 18)) return false;
        return layout.triangles.every(item => (item.side === '实心' || item.side === '空心') && (item.rotation == null || (Number.isInteger(Number(item.rotation)) && Number(item.rotation) >= 0 && Number(item.rotation) <= 2)));
    }
    function validateSpecialLayout(specials) {
        if (!Array.isArray(specials) || specials.length !== SPECIAL_CELLS.length) return false;
        const expectedKeys = new Set(SPECIAL_CELLS.map(([q, r]) => key(q, r)));
        if (specials.some(cell => !expectedKeys.has(key(cell.q, cell.r)) || !cell.image)) return false;
        const values = specials.map(cell => cell.image);
        if (FLEET_IMAGES.some(image => values.filter(value => value === image).length !== 1)) return false;
        if (values.filter(value => value === '源行星.png').length !== 1 || values.filter(value => value === '小行星.png').length !== 4 || values.filter(value => value === '空.png').length !== 1) return false;
        const fleets = specials.filter(cell => FLEET_IMAGES.includes(cell.image));
        return fleets.every((fleet, index) => fleets.slice(index + 1).every(other => distance(fleet.q - other.q, fleet.r - other.r) > 3));
    }
    function generate() {
        const layout = {
            version: 1,
            generatedAt: new Date().toISOString(),
            r2: createR2Layout(),
            triangles: createTriangleLayout(),
            specials: createSpecialLayout()
        };
        layout.conflicts = planetConflicts(layout.r2).length;
        return layout;
    }
    function validate(layout) {
        const centerNumbers = layout.r2.slice(0, 2).map(sector => sector.number);
        return {
            valid: layout.r2.length === 10 && new Set(layout.r2.map(sector => sector.number)).size === 10 &&
                centerNumbers.every(number => ['1','2','3','4'].includes(number)) &&
                layout.r2.every(sector => Number.isInteger(sector.rotation) && sector.rotation >= 0 && sector.rotation <= 5) &&
                planetConflicts(layout.r2).length === 0 &&
                layout.triangles.length === 8 && new Set(layout.triangles.map(sector => sector.number)).size === 8 &&
                layout.triangles.every(sector => Number.isInteger(sector.rotation) && sector.rotation >= 0 && sector.rotation <= 2 && ['实心','空心'].includes(sector.side)) &&
                validateSpecialLayout(layout.specials),
            planetConflicts: planetConflicts(layout.r2).length,
            centerNumbers
        };
    }

    window.GaiaMapCore = {
        constants: {
            HEX_SIZE,
            SQRT3,
            MAP_ROTATION,
            R2_POSITIONS,
            TRIANGLE_SLOTS,
            SPECIAL_CELLS,
            FLEET_IMAGES,
            OTHER_SPECIAL_IMAGES,
            DIRECTIONS
        },
        key,
        distance,
        pixel,
        placedR2Cells,
        placedTriangleCells,
        specialCellType,
        planetConflicts,
        rotatedBounds,
        createSpecialLayout,
        compactLayout,
        specialsToRecord,
        specialsFromRecord,
        expandCompactLayout,
        validateCompactLayout,
        validateSpecialLayout,
        generate,
        validate
    };
})();
