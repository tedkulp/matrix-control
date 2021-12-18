const express = require('express');
const app = express();
const port = process.env.PORT || 3000;

const serialPorts = {
    'matrix1': require('./lib/serial')('/dev/ttyUSB0', 'top', 4, 2),
    'matrix2': require('./lib/serial')('/dev/ttyUSB1', 'bottom', 4, 4),
};

app.get('/api/v1/matrix/:matrixId', (req, res) => {
    res.send(serialPorts[`matrix${req.params.matrixId}`].getStatus());
});

app.post('/api/v1/matrix/:matrixId/:id', (req, res) => {
    serialPorts[`matrix${req.params.matrixId}`].switchCmd(req.params.id);
    res.send('done');
});

app.listen(port, () => console.log(`Example app listening on port ${port}!`));
