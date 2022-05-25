const debug = require('debug')('chums:lib:sps:updates');
const {mysql2Pool} = require('chums-local-modules');

async function updateItems() {
    let connection;
    try {
        const querySelect = `SELECT Company, ARDivisionNo, CustomerNo, MapField, CSVField, CustomerValue, MappedValue, MappedOptions
                       FROM sps_edi.mapping
                       WHERE MapField = 'ItemCode' and MappedValue like '{%'`;

        const queryUpdate = `INSERT INTO sps_edi.mapping (Company, ARDivisionNo, CustomerNo, MapField, CSVField,
                                                    CustomerValue, MappedValue, MappedOptions)
                       VALUES (:Company, :ARDivisionNo, :CustomerNo, :MapField, :CSVField, :CustomerValue,
                               :MappedValue, :MappedOptions)
                       ON DUPLICATE KEY UPDATE CSVField = :CSVField,
                                               MappedValue = :MappedValue,
                                               MappedOptions = :MappedOptions`;
        connection = await mysql2Pool.getConnection();
        const [rows] = await connection.query(querySelect);
        rows.forEach(row => {
            row.MappedOptions = JSON.parse(row.MappedValue);
            row.MappedValue = row.MappedOptions.ItemCode;
            delete row.MappedOptions.ItemCode;
        });

        await Promise.all(rows.map(row => {
            const data = {...row};
            data.MappedOptions = JSON.stringify(row.MappedOptions);
            return connection.query(queryUpdate, data);
        }));
        const [items] = await connection.query(querySelect);
        connection.release();
        rows.forEach(row => {
            row.MappedOptions = JSON.parse(row.MappedValue);
        });
        return items;
    } catch(err) {
        if (connection) {
            connection.release();
        }
        debug("updateItems()", err.message);
        return Promise.reject(err);
    }
}

exports.fixMappedValueToMappedOptions = (req, res) => {
    updateItems()
        .then((result) => {
            res.json({success: true, result});
        })
        .catch(err => {
            res.json({error: err.message});
        })
};
