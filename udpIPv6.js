'use strict';
let portIPv6 = process.env.UDP_PORT_6LOWPAN || 7878;
let hostIPv6 = process.env.UDP_IPV6_6LOWPAN || 'aaaa::1';
let dgram = require('dgram');
let serverUDP = dgram.createSocket('udp6');
let sensorModel = require('./models/ipv6Sensor');
let disableLogs = false;
let mongo = require('./dbMongo');
let IS = require('initial-state');
let bucket = IS.bucket('Sensores ITT Chip', 'n2caJWeGsQOLxX4j4y6xnFogm1rCbn0Q');
let ignore = false;
let lastValuesQuery = {
    "rssi": {
        "$slice": -1
    },
    "temp": {
        "$slice": -1
    },
    "bat": {
        "$slice": -1
    },
    "rota": {
        "$slice": -1
    }
};

bucket.on('error',function(e){
  console.log(e);
});

mongo();

serverUDP.on('listening', function() {
    var address = serverUDP.address();
    console.log('[UDP - IPV6] Servidor IPv6 ativo end.:' + address.address + ":" + address.port);
});

serverUDP.on('message', processMessage);

serverUDP.bind(portIPv6, hostIPv6);

function processMessage(message, remote) {
    if (!disableLogs)
    console.log('[UDP - IPv6] ' + new Date().toISOString() + ' ' + remote.address + ' Port:' + remote.port + ' - ' + message);
    let dataArray = message.toString().split('|');

    sensorModel.findOne({
        'ipv6addr': remote.address
    }).exec(function(err, sensor) {
        if (!sensor) {
            let newSensor = new sensorModel();
            console.log('Sensor 6LoWPAN novo adicionado: ' + dataArray[0]);
            newSensor.alias = 'Sensor 6LoWPAN - ' + dataArray[0];
            newSensor.ipv6addr = remote.address;
            newSensor.save(function(err, sucess) {
                if (err) {
                    console.log('Ocorreu um erro ao salvar o sensor no banco');
                } else {
                    console.log(sucess);
                }
            });
        } else {
            updateSensor(sensor, dataArray);
        }
    });
}

function updateKey(sensorType, sensor, valueNew) {
    let updateValueQuery;

    switch (sensorType) {
        case 'temp':
            updateValueQuery = {
                $push: {
                    "temp": {
                        value: valueNew
                    }
                }
            };
            break;
        case 'bat':
            updateValueQuery = {
                $push: {
                    "bat": {
                        value: valueNew
                    }
                }
            };
            break;
        case 'rssi':
            updateValueQuery = {
                $push: {
                    "rssi": {
                        value: valueNew
                    }
                }
            };
            break;
        case 'rota':
            updateValueQuery = {
                $push: {
                    "rota": {
                        value: valueNew
                    }
                }
            };
            break;
        default:

    }
    sensorModel.findByIdAndUpdate(sensor._id, updateValueQuery).exec(
        function(err, sensorUpdate) {
            if (err) {
                console.log('Erro ao atualizar dados de sensores: ' + err);
            } else {
                if (!disableLogs)
                    console.log('Novo registro de ' + sensorType + ' - ' + valueNew);
            }
        });
}

function updateSensor(sensor, dataArray) {
    let formatTemp = dataArray[1].split('C');
    formatTemp = String(parseInt(formatTemp[0])/100)+' C';
    bucket.push('Temperatura NTC '+dataArray[0],formatTemp);
    bucket.push('Bateria '+dataArray[0], dataArray[2]);

    sensorModel.findByIdAndUpdate(sensor._id, {
            'updatedAt': new Date()
        })
        .exec(function(err, updated) {});

    sensorModel.findById(sensor._id)
        .select(lastValuesQuery)
        .exec(function(err, sensorLast) {
            if (!sensorLast.rota.length ||
                dataArray[4] !== sensorLast.rota[0].value)
                updateKey("rota", sensorLast, dataArray[4]);

            if (!sensorLast.rssi.length ||
                dataArray[3] !== sensorLast.rssi[0].value)
                updateKey("rssi", sensorLast, dataArray[3]);

            if (!sensorLast.bat.length ||
                dataArray[2] !== sensorLast.temp[0].value)
                updateKey("bat", sensorLast, dataArray[2]);

            if (!sensorLast.temp.length ||
                dataArray[1] !== sensorLast.temp[0].value)
                updateKey("temp", sensorLast, dataArray[1]);
        });
}
