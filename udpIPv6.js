'use strict';
let portIPv6 = process.env.UDP_PORT_6LOWPAN || 7878;
let hostIPv6 = process.env.UDP_IPV6_6LOWPAN || 'aaaa::1';
let dgram = require('dgram');
let serverUDP = dgram.createSocket('udp6');
let sensorModel = require('./models/ipv6Sensor');
let disableLogs = true;
let mongo = require('./dbMongo');

mongo();

serverUDP.on('listening', function() {
    var address = serverUDP.address();
    console.log('[UDP - IPV6] Servidor IPv6 ativo end.:' + address.address + ":" + address.port);
});

serverUDP.on('message', processMessage);

serverUDP.bind(portIPv6, hostIPv6);

function processMessage(message, remote) {
    if (!disableLogs)
        console.log('[ UDP - IPv6] ' + new Date().toISOString() + ' ' + remote.address + ' Port:' + remote.port + ' - ' + message);
    let dataArray = message.toString().split('|');

    sensorModel.findOne({
        'ipv6addr': remote.address
    }).exec(function(err, sensor) {
        if (!sensor) {
            let newSensor = new sensorModel();
            console.log('Sensor 6LoWPAN novo adicionado: '+dataArray[0]);
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

function updateSensor(sensor, dataArray) {
    sensorModel.aggregate([{
        $match: {
            '_id': sensor._id
        }
    }, {
        $project: {
            'temp': {
                $slice: ["$temp.value", -1]
            },
            'bat': {
                $slice: ["$bat.value", -1]
            },
            'rssi': {
                $slice: ["$rssi.value", -1]
            }
        }
    }]).exec(function(err, data) {
        let updatedValue = 0;
        if (data[0].temp[0] !== dataArray[1]) {
            updatedValue = 1;
            sensorModel.findByIdAndUpdate(sensor._id, {
                    $push: {
                        "temp": {
                            value: dataArray[1]
                        }
                    }
                },
                function(err, sensorUpdate) {
                    if (err) {
                        console.log('Erro ao atualizar dados de sensores: ' + err);
                    } else {
                        if (!disableLogs)
                            console.log('Novo registro de temperatura - ' + dataArray[1]);
                    }
                });
        }
        if (data[0].bat[0] !== dataArray[2]) {
            updatedValue = 1;
            sensorModel.findByIdAndUpdate(sensor._id, {
                    $push: {
                        "bat": {
                            value: dataArray[2]
                        }
                    }
                },
                function(err, sensorUpdate) {
                    if (err) {
                        console.log('Erro ao atualizar dados de sensores: ' + err);
                    } else {
                        if (!disableLogs)
                            console.log('Novo registro de bateria - ' + dataArray[2]);
                    }
                });
        }
        if (data[0].rssi[0] !== dataArray[3]) {
            updatedValue = 1;
            sensorModel.findByIdAndUpdate(sensor._id, {
                    $push: {
                        "rssi": {
                            value: dataArray[3]
                        }
                    }
                },
                function(err, sensorUpdate) {
                    if (err) {
                        console.log('Erro ao atualizar dados de sensores: ' + err);
                    } else {
                        if (!disableLogs)
                            console.log('Novo registro de rssi - ' + dataArray[3]);
                    }
                });
        }
        // if (updatedValue === 1) {
        sensorModel.findByIdAndUpdate(sensor._id, {
            'updatedAt': new Date()
        }).exec(function(err, updated) {});
        // }
    });
}
