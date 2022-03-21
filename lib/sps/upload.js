const debug = require('debug')('chums:lib:sps:upload');
const formidable = require('formidable');
const {UPLOAD_PATH} = require('./settings');

/**
 *
 * @param {Express.Request} req
 * @return {Promise<unknown>}
 */
async function handleUpload(req) {
    return new Promise((resolve, reject) => {
        const form = new formidable.IncomingForm({uploadDir: UPLOAD_PATH, keepExtensions: true});
        form.on('error', (err) => {
            debug('error', err);
            return reject(new Error(err));
        });

        form.on('aborted', () => {
            debug('aborted');
            return reject(new Error('upload aborted'));
        });

        form.parse(req, (err, fields, files) => {
            const [file] = Object.values(files);
            if (!file) {
                debug('file was not found?', file);
                return reject({error: 'file was not found'});
            }
            return resolve(file);
        })

    })
}

exports.handleUpload = handleUpload;

exports.upload = async (req, res) => {
    try {
        const upload = await handleUpload(req);
        return res.json({upload});
    } catch (err) {
        debug("upload()", err.message);
        return res.json({error: err.message, name: err.name});
    }
};
