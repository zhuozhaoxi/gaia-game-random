#!/usr/bin/env node

'use strict';

const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const SAMPLE_COUNT = Number(process.argv[2] || 200000);
const SEED = Number(process.argv[3] || 20260925) >>> 0;
const ROOT = path.resolve(__dirname, '..');

const R2_POSITIONS = [[0,0],[5,-4],[-5,4],[-1,5],[4,1],[9,-3],[10,-8],[6,-9],[1,-5],[-4,-1]];
const TRIANGLE_SLOTS = [
    [[-2,-4],[-3,-4],[-2,-5]],
    [[3,-8],[2,-8],[3,-9]],
    [[12,-6],[11,-6],[12,-7]],
    [[9,-10],[9,-11],[10,-11]],
    [[7,1],[7,0],[8,0]],
    [[2,5],[2,4],[3,4]],
    [[-5,7],[-4,6],[-4,7]],
    [[-7,3],[-7,2],[-6,2]]
];
const SPECIAL_CELLS = [[-3,1],[-2,3],[1,2],[-1,-2],[3,-1],[6,-2],[8,-5],[7,-7],[4,-6],[2,-3]];
const FLEETS = ['舰队-VK.png','舰队-拓邦.png','舰队-永恒盖亚.png','舰队-鹦鹉螺.png'];
const SPECIAL_TYPES = [...FLEETS, '源行星.png', '小行星.png', '空.png'];

function mulberry32(seed) {
    return function random() {
        let value = seed += 0x6D2B79F5;
        value = Math.imul(value ^ value >>> 15, value | 1);
        value ^= value + Math.imul(value ^ value >>> 7, value | 61);
        return ((value ^ value >>> 14) >>> 0) / 4294967296;
    };
}

function loadGenerator() {
    const sandboxMath = Object.create(Math);
    sandboxMath.random = mulberry32(SEED);
    const sandbox = {console, Date, Math: sandboxMath};
    sandbox.window = sandbox;
    vm.createContext(sandbox);
    for (const file of ['js/r2-boards.js', 'js/gaia-map-generator.js']) {
        vm.runInContext(fs.readFileSync(path.join(ROOT, file), 'utf8'), sandbox, {filename: file});
    }
    return sandbox.GaiaMapGenerator;
}

function matrix(rows, columns) {
    return Object.fromEntries(rows.map(row => [row, Array(columns).fill(0)]));
}

function key(q, r) {
    return `${q},${r}`;
}

function distance(first, second) {
    const q = first[0] - second[0];
    const r = first[1] - second[1];
    return Math.max(Math.abs(q), Math.abs(r), Math.abs(-q-r));
}

function specialExpectations() {
    const combinations = [];
    for (let a = 0; a < SPECIAL_CELLS.length; a++) {
        for (let b = a + 1; b < SPECIAL_CELLS.length; b++) {
            for (let c = b + 1; c < SPECIAL_CELLS.length; c++) {
                for (let d = c + 1; d < SPECIAL_CELLS.length; d++) {
                    const indexes = [a,b,c,d];
                    if (indexes.every((value, index) => indexes.slice(index + 1)
                        .every(other => distance(SPECIAL_CELLS[value], SPECIAL_CELLS[other]) > 3))) {
                        combinations.push(indexes);
                    }
                }
            }
        }
    }
    const inclusion = SPECIAL_CELLS.map((_, index) =>
        combinations.filter(combination => combination.includes(index)).length / combinations.length);
    return {
        validFleetCombinations: combinations.length,
        fleetOccupancy: inclusion,
        eachFleet: inclusion.map(probability => probability / 4),
        sourceOrEmpty: inclusion.map(probability => (1 - probability) / 6),
        asteroid: inclusion.map(probability => (1 - probability) * 4 / 6)
    };
}

function expectedR2Position(board) {
    return Number(board) <= 4
        ? [0.25, 0.25, ...Array(8).fill(0.0625)]
        : [0, 0, ...Array(8).fill(0.125)];
}

function summarize(counts, denominator, expected) {
    const observed = counts.map(value => value / denominator);
    const deviations = observed.map((value, index) => value - expected[index]);
    return {
        observed,
        expected,
        maxAbsDeviationPercentagePoints: Math.max(...deviations.map(value => Math.abs(value))) * 100,
        rmsDeviationPercentagePoints: Math.sqrt(deviations.reduce((sum, value) => sum + value * value, 0) / deviations.length) * 100
    };
}

function main() {
    if (!Number.isInteger(SAMPLE_COUNT) || SAMPLE_COUNT <= 0) throw new Error('sample count must be a positive integer');
    const generator = loadGenerator();
    const r2Boards = Array.from({length: 10}, (_, index) => String(index + 1));
    const triangleBoards = Array.from({length: 8}, (_, index) => String(index + 11));
    const r2Position = matrix(r2Boards, 10);
    const r2Rotation = matrix(r2Boards, 6);
    const trianglePosition = matrix(triangleBoards, 8);
    const triangleRotation = matrix(triangleBoards, 3);
    const triangleSide = matrix(triangleBoards, 2);
    const specialPosition = matrix(SPECIAL_TYPES, 10);
    const r2SlotIndex = new Map(R2_POSITIONS.map((cell, index) => [key(...cell), index]));
    const triangleSlotIndex = new Map(TRIANGLE_SLOTS.map((cells, index) => [cells.map(cell => key(...cell)).join('|'), index]));
    const specialSlotIndex = new Map(SPECIAL_CELLS.map((cell, index) => [key(...cell), index]));
    let invalidLayouts = 0;
    let generationErrors = 0;
    const startedAt = Date.now();

    for (let sample = 0; sample < SAMPLE_COUNT; sample++) {
        let layout;
        try {
            layout = generator.generate();
        } catch (error) {
            generationErrors++;
            continue;
        }
        if (!generator.validate(layout).valid) invalidLayouts++;
        for (const sector of layout.r2) {
            r2Position[sector.number][r2SlotIndex.get(key(sector.q, sector.r))]++;
            r2Rotation[sector.number][sector.rotation]++;
        }
        for (const sector of layout.triangles) {
            const slot = triangleSlotIndex.get(sector.cells.map(cell => key(...cell)).join('|'));
            trianglePosition[sector.number][slot]++;
            triangleRotation[sector.number][sector.rotation]++;
            triangleSide[sector.number][sector.side === '实心' ? 0 : 1]++;
        }
        for (const sector of layout.specials) {
            specialPosition[sector.image][specialSlotIndex.get(key(sector.q, sector.r))]++;
        }
    }

    const specialExpected = specialExpectations();
    const specialExpectedByType = Object.fromEntries(SPECIAL_TYPES.map(type => {
        if (FLEETS.includes(type)) return [type, specialExpected.eachFleet];
        if (type === '小行星.png') return [type, specialExpected.asteroid];
        return [type, specialExpected.sourceOrEmpty];
    }));
    const report = {
        metadata: {
            sampleCount: SAMPLE_COUNT,
            seed: SEED,
            elapsedSeconds: (Date.now() - startedAt) / 1000,
            invalidLayouts,
            generationErrors
        },
        slots: {
            r2: R2_POSITIONS.map(cell => key(...cell)),
            triangles: TRIANGLE_SLOTS.map(cells => cells.map(cell => key(...cell)).join('|')),
            specials: SPECIAL_CELLS.map(cell => key(...cell))
        },
        r2: {
            position: Object.fromEntries(r2Boards.map(board => [board, summarize(r2Position[board], SAMPLE_COUNT, expectedR2Position(board))])),
            rotation: Object.fromEntries(r2Boards.map(board => [board, summarize(r2Rotation[board], SAMPLE_COUNT, Array(6).fill(1 / 6))]))
        },
        triangles: {
            position: Object.fromEntries(triangleBoards.map(board => [board, summarize(trianglePosition[board], SAMPLE_COUNT, Array(8).fill(1 / 8))])),
            rotation: Object.fromEntries(triangleBoards.map(board => [board, summarize(triangleRotation[board], SAMPLE_COUNT, Array(3).fill(1 / 3))])),
            side: Object.fromEntries(triangleBoards.map(board => [board, summarize(triangleSide[board], SAMPLE_COUNT, [0.5, 0.5])]))
        },
        specials: {
            validFleetCombinations: specialExpected.validFleetCombinations,
            fleetOccupancyExpected: specialExpected.fleetOccupancy,
            position: Object.fromEntries(SPECIAL_TYPES.map(type => [type, summarize(specialPosition[type], SAMPLE_COUNT, specialExpectedByType[type])]))
        }
    };
    process.stdout.write(`${JSON.stringify(report)}\n`);
}

main();
