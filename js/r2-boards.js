(function () {
    'use strict';

    const library = {
        standardPlanetTypes: ['red', 'blue', 'yellow', 'brown', 'orange', 'white', 'black'],
        planetTypes: {
            red: '红', blue: '蓝', yellow: '黄', brown: '棕',
            orange: '橙', white: '白', black: '黑'
        },
        cellTypes: {
            red: {label: '红色行星', color: '#d94b45'},
            blue: {label: '蓝色行星', color: '#4388c9'},
            yellow: {label: '黄色行星', color: '#e0bd34'},
            brown: {label: '棕色行星', color: '#8b5b3d'},
            orange: {label: '橙色行星', color: '#e88b31'},
            white: {label: '白色行星', color: '#f7f5e8'},
            black: {label: '黑色行星', color: '#232622'},
            asteroid: {label: '小行星', color: '#a98c91'},
            source: {label: '源行星', color: '#b9f2ef'},
            transdim: {label: '超维星球', color: '#9a3f92'},
            gaia: {label: '盖亚星球', color: '#45a95a'}
        },
        boards: {
            '1': { image: '01-实心.png', cellAnnotations: {'0,2':'red','1,1':'orange','-2,1':'yellow','-1,0':'brown','1,-1':'blue','2,-1':'transdim'} },
            '2': { image: '02-实心.png', cellAnnotations: {'-1,2':'red','-1,1':'brown','1,-1':'white','-1,-1':'orange','2,-1':'yellow','0,-2':'black','1,1':'transdim'} },
            '3': { image: '03-实心.png', cellAnnotations: {'-1,2':'blue','0,2':'yellow','1,0':'white','2,-1':'black','0,-2':'transdim','-1,0':'gaia'} },
            '4': { image: '04-实心.png', cellAnnotations: {'0,-2':'black','0,-1':'red','-2,1':'white','-1,1':'orange','1,0':'brown','2,0':'blue'} },
            '5': { image: '05-实心.png', cellAnnotations: {'-1,2':'orange','0,2':'yellow','2,-1':'red','0,-2':'white','2,-2':'transdim','-1,0':'gaia'} },
            '6': { image: '06-实心.png', cellAnnotations: {'-1,0':'brown','2,0':'yellow','1,-1':'blue','1,-2':'transdim','1,1':'transdim','0,1':'gaia'} },
            '7': { image: '07-实心.png', cellAnnotations: {'0,2':'black','0,-1':'red','1,-2':'brown','-2,0':'transdim','1,0':'gaia','-1,1':'gaia'} },
            '8': { image: '08-实心.png', cellAnnotations: {'0,-1':'white','0,-2':'blue','1,0':'black','-1,1':'orange','-1,2':'transdim','2,-2':'transdim'} },
            '9': { image: '09-实心.png', cellAnnotations: {'-2,2':'brown','-1,-1':'orange','2,-2':'white','-1,1':'black','1,-2':'transdim','1,0':'gaia'} },
            '10': { image: '10-实心.png', cellAnnotations: {'-2,2':'blue','-1,0':'yellow','-1,2':'red','1,-2':'transdim','2,-2':'transdim','1,0':'gaia'} }
        },
        triangleBoards: {
            '11': {
                '实心': {cellAnnotations: {'0':'source','120':'asteroid'}},
                '空心': {cellAnnotations: {'120':'asteroid'}}
            },
            '12': {
                '实心': {cellAnnotations: {'0':'transdim','120':'source'}},
                '空心': {cellAnnotations: {'0':'asteroid'}}
            },
            '13': {
                '实心': {cellAnnotations: {'0':'transdim','240':'asteroid'}},
                '空心': {cellAnnotations: {'240':'asteroid'}}
            },
            '14': {
                '实心': {cellAnnotations: {'0':'source','240':'asteroid'}},
                '空心': {cellAnnotations: {'240':'asteroid'}}
            },
            '15': {
                '实心': {cellAnnotations: {'0':'source'}},
                '空心': {cellAnnotations: {'0':'source','240':'asteroid'}}
            },
            '16': {
                '实心': {cellAnnotations: {'240':'source'}},
                '空心': {cellAnnotations: {'0':'asteroid','240':'asteroid'}}
            },
            '17': {
                '实心': {cellAnnotations: {'0':'transdim'}},
                '空心': {cellAnnotations: {'120':'asteroid'}}
            },
            '18': {
                '实心': {cellAnnotations: {'0':'source'}},
                '空心': {cellAnnotations: {'120':'asteroid'}}
            }
        },
        specialBoards: {
            '小行星.png': {cellAnnotation: 'asteroid'},
            '源行星.png': {cellAnnotation: 'source'}
        }
    };

    window.GAIA_BOARD_LIBRARY = library;
    window.GAIA_R2_BOARD_LIBRARY = library;
})();
