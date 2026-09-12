'use strict';

const fs = require('fs');
const path = require('path');
const sourceParts = ["part-01.jsfrag","part-02.jsfrag","part-03.jsfrag","part-04.jsfrag","part-05.jsfrag"];
const source = sourceParts.map((name) => fs.readFileSync(path.join(__dirname, 'main.parts', name), 'utf8')).join('');
module._compile(source, __filename);
