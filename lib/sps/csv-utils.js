const debug = require('debug')('chums:lib:sps:import-verification');
const formidable = require('formidable');
const {UPLOAD_PATH} = require('./settings');

const {unlink, readFile} = require('fs/promises');


async function parseFile(filename, removeUpload = true) {
    try {
        const buffer = await readFile(filename);
        const csv = Buffer.from(buffer).toString();
        const lines = csv.trim().split('\n');
        const [header, ...rest] = lines;
        const fields = header.split(',').map(str => str.trim());
        if (removeUpload) {
            await unlink(filename);
        }
        return rest
            .map((line, _index) => {
                const row = {_index};
                line.split(',')
                    .forEach((value, index) => {
                        row[fields[index]] = value;
                    });
                return row;
            });
    } catch (err) {
        debug("parseFile()", err.message);
        return Promise.reject(err);
    }
}

exports.parseFile = parseFile;

function handleUpload(req) {
    return new Promise((resolve, reject) => {
        const form = new formidable.IncomingForm();
        const response = {
            progress: [],
            name: '',
        };
        form.uploadDir = UPLOAD_PATH;
        form.keepExtensions = true;

        form.on('file', (name) => {
            response.name = name;
        });

        form.on('error', (err) => {
            debug('error', err);
            return reject(new Error(err));
        });

        form.on('aborted', () => {
            debug('aborted');
            return reject(new Error('upload aborted'));
        });

        form.parse(req, (err, fields, files) => {
            const [file] = Object.keys(files).map(key => files[key]);
            if (!file) {
                debug('file was not found?', file);
                return reject({error: 'file was not found'});
            }
            return resolve(file);
        })

    })
}
exports.handleUpload = handleUpload;
