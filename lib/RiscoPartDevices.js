'use strict';

class RiscoCPBaseParts {
    constructor(log, accConfig, api, accessory) {
        this.ClassName = this.constructor.name;
        this.log = log;
        this.name = accConfig.context.name;
        this.RiscoSession = accConfig.RiscoSession;
        this.DeviceInstance = accConfig.context.ObjInst;
        this.DeviceMBInst = accConfig.context.MBObj;
        this.IsMB = (this.DeviceMBInst !== undefined) ? true : false;
        this.accessory = accessory;
        this.api = api;
        this.OccupancyPreventArming = (accConfig.OccupancyPreventArming != undefined) ? accConfig.OccupancyPreventArming : true;
        
        
        this.Service = this.api.hap.Service;
        this.Characteristic = this.api.hap.Characteristic;
        this.mainService = this.accessory.getService(this.Service.SecuritySystem, this.accessory.displayName);
        this.OccupancyService = this.accessory.getService(this.Service.OccupancySensor, `occupancy_${this.accessory.displayName}`);
        if (this.IsMB) {
            this.BatteryService = this.accessory.getService(this.Service.Battery, this.accessory.displayName);
        }

        // 0, 1, 3, 4
        this.VALID_CURRENT_STATE_VALUES = [
            this.Characteristic.SecuritySystemCurrentState.STAY_ARM,
            this.Characteristic.SecuritySystemCurrentState.AWAY_ARM,
            this.Characteristic.SecuritySystemCurrentState.DISARMED,
            this.Characteristic.SecuritySystemCurrentState.ALARM_TRIGGERED
        ];

        this.VALID_TARGET_STATE_VALUES = [
            this.Characteristic.SecuritySystemTargetState.STAY_ARM,
            this.Characteristic.SecuritySystemTargetState.AWAY_ARM,
            this.Characteristic.SecuritySystemTargetState.DISARM
        ];

        this.mainService
            .getCharacteristic(this.Characteristic.SecuritySystemCurrentState)
            .setProps({ validValues: this.VALID_CURRENT_STATE_VALUES })
            .on('get', this.getCurrentState.bind(this));

        this.mainService
            .getCharacteristic(this.Characteristic.SecuritySystemTargetState)
            .setProps({ validValues: this.VALID_TARGET_STATE_VALUES })
            .on('get', this.getTargetState.bind(this))
            .on('set', this.setTargetState.bind(this));

        this.OccupancyService
            .getCharacteristic(this.Characteristic.OccupancyDetected)
            .on('get', this.getCurrentOccupancyState.bind(this));

        if (this.IsMB) {
            this.BatteryService
                .getCharacteristic(this.Characteristic.StatusLowBattery)
                .on('get', this.getCurrentBatteryState.bind(this));
            this.BatteryService
                .getCharacteristic(this.Characteristic.BatteryLevel)
                .on('get', this.getCurrentBatteryLevel.bind(this));
            this.mainService
                .getCharacteristic(this.Characteristic.StatusFault)
                .on('get', this.getFaultStatus.bind(this));
            this.mainService
                .getCharacteristic(this.Characteristic.StatusTampered)
                .on('get', this.getTamperStatus.bind(this));
        }
        //avoid maxlistener warning
        const MaxApiListeners = this.api.getMaxListeners();
        const ActualListeners = this.api.listenerCount('shutdown');
        this.log.debug(`Api Event Shutdown : \nActual Listener :${this.api.listenerCount('shutdown')} for Maximum :${MaxApiListeners}`);
        if (ActualListeners >= MaxApiListeners) {
            //give one more for other process
            this.api.setMaxListeners(ActualListeners + 2);
            this.log.debug(`Max Listener Exceeded. Set To :${(ActualListeners + 2)}`);
        }

        this.DeviceHandlers();

        if (this.IsMB) {
            this.DeviceMBInst.on('LowBattery', () => {
                this.BatteryService.updateCharacteristic(this.Characteristic.StatusLowBattery, ((this.DeviceMBInst.LowBatteryTrouble) ? 1 : 0));
                this.BatteryService.updateCharacteristic(this.Characteristic.BatteryLevel, ((this.DeviceMBInst.LowBatteryTrouble) ? 10 : 100));
            });
            this.DeviceMBInst.on('BatteryOk', () => {
                this.BatteryService.updateCharacteristic(this.Characteristic.StatusLowBattery, ((this.DeviceMBInst.LowBatteryTrouble) ? 1 : 0));
                this.BatteryService.updateCharacteristic(this.Characteristic.BatteryLevel, ((this.DeviceMBInst.LowBatteryTrouble) ? 10 : 100));
            });
            this.DeviceMBInst.on('ACUnplugged', () => {
                this.mainService.updateCharacteristic(this.Characteristic.StatusFault, ((this.getFaultStatusValue()) ? 0 : 1));
            });
            this.DeviceMBInst.on('ACPlugged', () => {
                this.mainService.updateCharacteristic(this.Characteristic.StatusFault, ((this.getFaultStatusValue()) ? 0 : 1));
            });
            this.DeviceMBInst.on('PhoneLineTrouble', () => {
                this.mainService.updateCharacteristic(this.Characteristic.StatusFault, ((this.getFaultStatusValue()) ? 0 : 1));
            });
            this.DeviceMBInst.on('PhoneLineOk', () => {
                this.mainService.updateCharacteristic(this.Characteristic.StatusFault, ((this.getFaultStatusValue()) ? 0 : 1));
            });
            this.DeviceMBInst.on('ClockTrouble', () => {
                this.mainService.updateCharacteristic(this.Characteristic.StatusFault, ((this.getFaultStatusValue()) ? 0 : 1));
            });
            this.DeviceMBInst.on('ClockOk', () => {
                this.mainService.updateCharacteristic(this.Characteristic.StatusFault, ((this.getFaultStatusValue()) ? 0 : 1));
            });
            this.DeviceMBInst.on('MS1ReportTrouble', () => {
                this.mainService.updateCharacteristic(this.Characteristic.StatusFault, ((this.getFaultStatusValue()) ? 0 : 1));
            });
            this.DeviceMBInst.on('MS1ReportOk', () => {
                this.mainService.updateCharacteristic(this.Characteristic.StatusFault, ((this.getFaultStatusValue()) ? 0 : 1));
            });
            this.DeviceMBInst.on('MS2ReportTrouble', () => {
                this.mainService.updateCharacteristic(this.Characteristic.StatusFault, ((this.getFaultStatusValue()) ? 0 : 1));
            });
            this.DeviceMBInst.on('MS2ReportOk', () => {
                this.mainService.updateCharacteristic(this.Characteristic.StatusFault, ((this.getFaultStatusValue()) ? 0 : 1));
            });
            this.DeviceMBInst.on('MS3ReportTrouble', () => {
                this.mainService.updateCharacteristic(this.Characteristic.StatusFault, ((this.getFaultStatusValue()) ? 0 : 1));
            });
            this.DeviceMBInst.on('MS3ReportOk', () => {
                this.mainService.updateCharacteristic(this.Characteristic.StatusFault, ((this.getFaultStatusValue()) ? 0 : 1));
            });
            this.DeviceMBInst.on('AuxTrouble', () => {
                this.mainService.updateCharacteristic(this.Characteristic.StatusFault, ((this.getFaultStatusValue()) ? 0 : 1));
            });
            this.DeviceMBInst.on('AuxOk', () => {
                this.mainService.updateCharacteristic(this.Characteristic.StatusFault, ((this.getFaultStatusValue()) ? 0 : 1));
            });
            this.DeviceMBInst.on('Rs485BusTrouble', () => {
                this.mainService.updateCharacteristic(this.Characteristic.StatusFault, ((this.getFaultStatusValue()) ? 0 : 1));
            });
            this.DeviceMBInst.on('Rs485BusOk', () => {
                this.mainService.updateCharacteristic(this.Characteristic.StatusFault, ((this.getFaultStatusValue()) ? 0 : 1));
            });
            this.DeviceMBInst.on('BellTrouble', () => {
                this.mainService.updateCharacteristic(this.Characteristic.StatusFault, ((this.getFaultStatusValue()) ? 0 : 1));
            });
            this.DeviceMBInst.on('BellOk', () => {
                this.mainService.updateCharacteristic(this.Characteristic.StatusFault, ((this.getFaultStatusValue()) ? 0 : 1));
            });
            this.DeviceMBInst.on('ServiceExpired', () => {
                this.mainService.updateCharacteristic(this.Characteristic.StatusFault, ((this.getFaultStatusValue()) ? 0 : 1));
            });
            this.DeviceMBInst.on('ServiceOk', () => {
                this.mainService.updateCharacteristic(this.Characteristic.StatusFault, ((this.getFaultStatusValue()) ? 0 : 1));
            });
            this.DeviceMBInst.on('PaymentExpired', () => {
                this.mainService.updateCharacteristic(this.Characteristic.StatusFault, ((this.getFaultStatusValue()) ? 0 : 1));
            });
            this.DeviceMBInst.on('PaymentOk', () => {
                this.mainService.updateCharacteristic(this.Characteristic.StatusFault, ((this.getFaultStatusValue()) ? 0 : 1));
            });
            this.DeviceMBInst.on('BoxTamperOpen', () => {
                this.mainService.updateCharacteristic(this.Characteristic.StatusTampered, ((this.getTamperStatusValue()) ? 0 : 1));
            });
            this.DeviceMBInst.on('BoxTamperClosed', () => {
                this.mainService.updateCharacteristic(this.Characteristic.StatusTampered, ((this.getTamperStatusValue()) ? 0 : 1));
            });
            this.DeviceMBInst.on('JammingTrouble', () => {
                this.mainService.updateCharacteristic(this.Characteristic.StatusTampered, ((this.getTamperStatusValue()) ? 0 : 1));
            });
            this.DeviceMBInst.on('JammingOk', () => {
                this.mainService.updateCharacteristic(this.Characteristic.StatusTampered, ((this.getTamperStatusValue()) ? 0 : 1));
            });
            this.DeviceMBInst.on('BellTamper', () => {
                this.mainService.updateCharacteristic(this.Characteristic.StatusTampered, ((this.getTamperStatusValue()) ? 0 : 1));
            });
            this.DeviceMBInst.on('BellTamperOk', () => {
                this.mainService.updateCharacteristic(this.Characteristic.StatusTampered, ((this.getTamperStatusValue()) ? 0 : 1));
            });
        }

        this.api.once('shutdown', () => {
            this.log.debug(`Cleaning Before Exit.\nRemove All Listeners for ${this.name}`);
            this.mainService
                .getCharacteristic(this.Characteristic.SecuritySystemCurrentState)
                .removeListener('get', this.getCurrentState);
            this.mainService
                .getCharacteristic(this.Characteristic.SecuritySystemTargetState)
                .removeListener('get', this.getTargetState)
                .removeListener('set', this.setTargetState);
            this.OccupancyService
                .getCharacteristic(this.Characteristic.OccupancyDetected)
                .removeListener('get', this.getCurrentOccupancyState);

            if (this.IsMB) {
                this.BatteryService
                    .getCharacteristic(this.Characteristic.StatusLowBattery)
                    .removeListener('get', this.getCurrentBatteryState);
                this.BatteryService
                    .getCharacteristic(this.Characteristic.BatteryLevel)
                    .removeListener('get', this.getCurrentBatteryLevel);
                this.mainService
                    .getCharacteristic(this.Characteristic.StatusFault)
                    .removeListener('get', this.getFaultStatus);
                this.mainService
                    .getCharacteristic(this.Characteristic.StatusTampered)
                    .removeListener('get', this.getTamperStatus);
            }
        });

        this.SetInitStatus();
    }

    getCurrentBatteryState(callback) {
        try {
            this.log.debug(`${this.sPrefix} "${this.name}" Battery State : (${this.DeviceMBInst.LowBatteryTrouble}) => ${(this.DeviceMBInst.LowBatteryTrouble) ? 'Not Ok': 'Ok'}`);
            callback(null, (this.DeviceMBInst.LowBatteryTrouble) ? 1 : 0);
            return;
        } catch (err) {
            this.log.error(`Error on ${this.ClassName}/${this.getFunctionName()}:\n${err}`);
            callback(null, (this.DeviceMBInst.LowBatteryTrouble) ? 1 : 0);
            return;
        }
    }

    getCurrentBatteryLevel(callback) {
        try {
            this.log.debug(`${this.sPrefix} "${this.name}" Battery Level (Fake) : (${this.DeviceMBInst.LowBatteryTrouble}) => ${(this.DeviceMBInst.LowBatteryTrouble) ? '10': '100'}`);
            callback(null, (this.DeviceMBInst.LowBatteryTrouble) ? 10 : 100);
            return;
        } catch (err) {
            this.log.error(`Error on ${this.ClassName}/${this.getFunctionName()}:\n${err}`);
            callback(null, (this.DeviceMBInst.LowBatteryTrouble) ? 10 : 100);
            return;
        }
    }

    getFaultStatus(callback) {
        let FaultStatus = true;
        try {
            FaultStatus = this.getFaultStatusValue();
            this.log.debug(`${this.sPrefix} "${this.name}" Fault Status : (${FaultStatus}) => ${(FaultStatus) ? 0: 1}`);
            callback(null, (FaultStatus) ? 0: 1);
            return;
        } catch (err) {
            this.log.error(`Error on ${this.ClassName}/${this.getFunctionName()}:\n${err}`);
            callback(null, (FaultStatus) ? 0: 1);
            return;
        }
    }

    getFaultStatusValue() {
        let FaultStatus = true;
        FaultStatus = this.DeviceMBInst.ACTrouble || 
            this.DeviceMBInst.PhoneLineTrouble || 
            this.DeviceMBInst.ClockTrouble || 
            this.DeviceMBInst.MS1ReportTrouble || 
            this.DeviceMBInst.MS2ReportTrouble || 
            this.DeviceMBInst.MS3ReportTrouble || 
            this.DeviceMBInst.AuxTrouble || 
            this.DeviceMBInst.Rs485BusTrouble || 
            this.DeviceMBInst.BellTrouble || 
            this.DeviceMBInst.ServiceExpired || 
            this.DeviceMBInst.PaymentExpired;
        return FaultStatus;
    }

    getTamperStatus(callback) {
        let TamperStatus = true;
        try {
            TamperStatus = this.getTamperStatusValue();
            this.log.debug(`${this.sPrefix} "${this.name}" Tamper Status : (${TamperStatus}) => ${(TamperStatus) ? 0: 1}`);
            callback(null, (TamperStatus) ? 0: 1);
            return;
        } catch (err) {
            this.log.error(`Error on ${this.ClassName}/${this.getFunctionName()}:\n${err}`);
            callback(null, (TamperStatus) ? 0: 1);
            return;
        }
    }

    getTamperStatusValue() {
        let TamperStatus = true;
        TamperStatus = this.DeviceMBInst.BellTamper || 
            this.DeviceMBInst.BoxTamper || 
            this.DeviceMBInst.JammingTrouble;
        return TamperStatus;
    }

}

class RiscoCPPartitions extends RiscoCPBaseParts {
    constructor(log, accConfig, api, accessory) {
        super(log, accConfig, api, accessory);
        this.sPrefix = 'Partition';
    }

    DeviceHandlers() {
        this.DeviceInstance.on('Alarm', () => {
            this.AlarmState();
        });
        this.DeviceInstance.on('StandBy', () => {
            this.NoAlarmState();
        });
        this.DeviceInstance.on('FalseCode', () => {
            this.AlarmState();
        });
        this.DeviceInstance.on('CodeOk', () => {
            this.NoAlarmState();
        });
        this.DeviceInstance.on('Fire', () => {
            this.AlarmState();
        });
        this.DeviceInstance.on('NoFire', () => {
            this.NoAlarmState();
        });
        this.DeviceInstance.on('Panic', () => {
            this.AlarmState();
        });
        this.DeviceInstance.on('NoPanic', () => {
            this.NoAlarmState();
        });
        this.DeviceInstance.on('Medic', () => {
            this.AlarmState();
        });
        this.DeviceInstance.on('NoMedic', () => {
            this.NoAlarmState();
        });
        this.DeviceInstance.on('Armed', () => {
            this.mainService.updateCharacteristic(this.Characteristic.SecuritySystemCurrentState, this.Characteristic.SecuritySystemCurrentState.AWAY_ARM);
            this.log.info('Changed Alarm Current State: AWAY');
        });
        this.DeviceInstance.on('Disarmed', () => {
            this.NoAlarmState();
        });
        this.DeviceInstance.on('HomeStay', () => {
            this.mainService.updateCharacteristic(this.Characteristic.SecuritySystemCurrentState, this.Characteristic.SecuritySystemCurrentState.STAY_ARM);
            this.log.info('Changed Alarm Current State: HOME');
        });
        this.DeviceInstance.on('HomeDisarmed', () => {
            this.NoAlarmState();
            this.log.info('Changed Alarm Current State: OFF');
        });
        this.DeviceInstance.on('ZoneOpen', () => {
            this.OccupancyService.updateCharacteristic(this.Characteristic.OccupancyDetected, 1);
        });
        this.DeviceInstance.on('ZoneClosed', () => {
            this.OccupancyService.updateCharacteristic(this.Characteristic.OccupancyDetected, 0);
        });
    }

    ActualArmedState(AsString = false) {
        if (AsString) {
            let PStateStr = 'Disarmed';
            if (this.DeviceInstance.Arm || this.DeviceInstance.HomeStay) {
                PStateStr = (this.DeviceInstance.Arm) ? 'Away Armed' : PStateStr;
                PStateStr = (this.DeviceInstance.HomeStay && !this.DeviceInstance.Arm) ? 'Home Stay Armed' : PStateStr;
            }
            return PStateStr;
        } else {
            let PState = this.Characteristic.SecuritySystemCurrentState.DISARMED;
            if (this.DeviceInstance.Arm || this.DeviceInstance.HomeStay) {
                PState = (this.DeviceInstance.Arm) ? this.Characteristic.SecuritySystemCurrentState.AWAY_ARM : PState;
                PState = (this.DeviceInstance.HomeStay && !this.DeviceInstance.Arm) ? this.Characteristic.SecuritySystemCurrentState.STAY_ARM : PState;
            }
            return PState;
        }
    }

    AlarmState() {
        let partition = this.DeviceInstance;
        let AlarmStatus = partition.Alarm || partition.FalseCode || partition.Fire || partition.Panic || partition.Medic || partition.Arm;
        if (AlarmStatus) {
            this.mainService.updateCharacteristic(this.Characteristic.SecuritySystemCurrentState, this.Characteristic.SecuritySystemCurrentState.ALARM_TRIGGERED);
        }
    }

    NoAlarmState() {
        let partition = this.DeviceInstance;
        let AlarmStatus = partition.FalseCode || partition.Fire || partition.Panic || partition.Medic || partition.Arm;
        if (!AlarmStatus) {
            let PStateStr = this.ActualArmedState(true);
            let PState = this.ActualArmedState();
            this.log.debug(`Partition "${this.name}" Arming State : (${PState}) => ${PStateStr}`);
            this.mainService.updateCharacteristic(this.Characteristic.SecuritySystemCurrentState, PState);
        }
    }

    SetInitStatus() {
        this.mainService.updateCharacteristic(this.Characteristic.SecuritySystemCurrentState, this.ActualArmedState());
        this.OccupancyService.updateCharacteristic(this.Characteristic.OccupancyDetected, ((this.DeviceInstance.Open) ? 1 : 0 ));

        if (this.IsMB) {
            this.BatteryService.updateCharacteristic(this.Characteristic.StatusLowBattery, ((this.DeviceMBInst.LowBatteryTrouble) ? 1 : 0));
            this.BatteryService.updateCharacteristic(this.Characteristic.BatteryLevel, ((this.DeviceMBInst.LowBatteryTrouble) ? 10 : 100));
        }
    }

    async setTargetState(state, callback) {
        try {
            const CanArm = function () {
                let OccupancyVar = false;
                if (this.OccupancyPreventArming) {
                    OccupancyVar = this.DeviceInstance.Open;
                }
                return (this.DeviceInstance.Ready && !this.DeviceInstance.Trouble && !OccupancyVar);
            }
            let CurrentState = this.ActualArmedState();

            if (CanArm) {
                switch (state) {
                    case this.Characteristic.SecuritySystemTargetState.STAY_ARM:
                        if (CurrentState !== state) {
                            if (CurrentState !== this.Characteristic.SecuritySystemCurrentState.DISARMED) {
                                this.log.debug(`Partition is not Disarmed, We need to Disarm It before change Arming mode`);
                                if (!await this.DeviceInstance.Disarm()) {
                                    const ErrMsg = `Partition "${this.name}" Cannot be Disarmed`;
                                    this.log.debug(ErrMsg);
                                    callback !== null && typeof callback === 'function' && callback(ErrMsg);
                                    return;
                                }
                            }
                            this.log.debug(`Setting "${this.name}" state to (${state}) -> Stay Arm`);
                            if (await this.DeviceInstance.HomeStayArm()) {
                                this.mainService.updateCharacteristic(this.Characteristic.SecuritySystemCurrentState, state);
                                callback !== null && typeof callback === 'function' && callback(null);
                                return;
                            }
                        } else {
                            this.log.debug(`Partition "${this.name}" is already Stay Armed`);
                        }
                        break;
                    case this.Characteristic.SecuritySystemTargetState.AWAY_ARM:
                        if (CurrentState !== state) {
                            if (CurrentState !== this.Characteristic.SecuritySystemCurrentState.DISARMED) {
                                this.log.debug(`Partition is not Disarmed, We need to Disarm It before change Arming mode`);
                                if (!await this.DeviceInstance.Disarm()) {
                                    const ErrMsg = `Partition "${this.name}" Cannot be Disarmed`;
                                    this.log.debug(ErrMsg);
                                    callback !== null && typeof callback === 'function' && callback(ErrMsg);
                                    return;
                                }
                            }
                            this.log.debug(`Setting "${this.name}" state to (${state}) -> Away Arm`);
                            if (await this.DeviceInstance.AwayArm()) {
                                this.mainService.updateCharacteristic(this.Characteristic.SecuritySystemCurrentState, state);
                                callback !== null && typeof callback === 'function' && callback(null);
                                return;
                            }
                        } else {
                            this.log.debug(`Partition "${this.name}" is already Away Armed`);
                        }
                        break;
                    case this.Characteristic.SecuritySystemTargetState.DISARM:
                        if (CurrentState !== state) {
                            this.log.debug(`Setting "${this.name}" state to (${state}) -> Disarm`);
                            if (await this.DeviceInstance.Disarm()) {
                                this.mainService.updateCharacteristic(this.Characteristic.SecuritySystemCurrentState, state);
                                callback !== null && typeof callback === 'function' && callback(null);
                                return;
                            }
                        } else {
                            this.log.debug(`Partition "${this.name}" is already Disarmed`);
                        }
                }
            } else {
                const ErrMsg = `Partition "${this.name}" Not Ready`;
                this.log.debug(ErrMsg);
                callback !== null && typeof callback === 'function' && callback(ErrMsg);
                return;
            }
        } catch (err) {
            this.log.error(`Error on ${this.ClassName}/${this.getFunctionName()}:\n${err}`);
            callback !== null && typeof callback === 'function' && callback(err);
            return;
        }
    }

    getTargetState(callback) {
        try {
            let TState = this.ActualArmedState();
            callback(null, TState);
            return;
        } catch (err) {
            this.log.error(`Error on ${this.ClassName}/${this.getFunctionName()}:\n${err}`);
            this.mainService.updateCharacteristic(this.Characteristic.SecuritySystemTargetState, TState);
            callback(err);
            return;
        }
    }

    getCurrentState(callback) {
        try {
            let PStateStr = this.ActualArmedState(true);
            let PState = this.ActualArmedState();
            this.log.debug(`Partition "${this.name}" Arming State : (${PState}) => ${PStateStr}`);
            this.mainService.updateCharacteristic(this.Characteristic.SecuritySystemCurrentState, PState);
            callback(null, PState);
            return;
        } catch (err) {
            this.log.error(`Error on ${this.ClassName}/${this.getFunctionName()}:\n${err}`);
            this.mainService.updateCharacteristic(this.Characteristic.SecuritySystemCurrentState, PState);
            callback(err);
            return;
        }
    }

    getCurrentOccupancyState(callback) {
        let OccupancyStatus = false;
        try {
            OccupancyStatus = this.DeviceInstance.Open || !this.DeviceInstance.Ready;
            this.log.debug(`Partition "${this.name}" Occupancy State : (${OccupancyStatus}) => ${((OccupancyStatus) ? 'Occupied' : 'Not Occupied' )}`);
            this.OccupancyService.updateCharacteristic(this.Characteristic.OccupancyDetected, ((OccupancyStatus) ? 1 : 0 ));
            callback(null, (OccupancyStatus) ? 1 : 0);
            return;
        } catch (err) {
            this.log.error(`Error on ${this.ClassName}/${this.getFunctionName()}:\n${err}`);
            this.OccupancyService.updateCharacteristic(this.Characteristic.OccupancyDetected, ((OccupancyStatus) ? 1 : 0 ));
            callback(err);
            return;
        }
    }
}

class RiscoCPSystem extends RiscoCPBaseParts {
    constructor(log, accConfig, api, accessory) {
        super(log, accConfig, api, accessory);
        this.sPrefix = 'System';
    }

    DeviceHandlers() {
        Object.values(this.DeviceInstance).forEach( partition => {
            partition.ObjInst.on('Alarm', () => {
                this.AlarmState();
            });
            partition.ObjInst.on('StandBy', () => {
                this.NoAlarmState();
            });
            partition.ObjInst.on('FalseCode', () => {
                this.AlarmState();
            });
            partition.ObjInst.on('CodeOk', () => {
                this.NoAlarmState();
            });
            partition.ObjInst.on('Fire', () => {
                this.AlarmState();
            });
            partition.ObjInst.on('NoFire', () => {
                this.NoAlarmState();
            });
            partition.ObjInst.on('Panic', () => {
                this.AlarmState();
            });
            partition.ObjInst.on('NoPanic', () => {
                this.NoAlarmState();
            });
            partition.ObjInst.on('Medic', () => {
                this.AlarmState();
            });
            partition.ObjInst.on('NoMedic', () => {
                this.NoAlarmState();
            });
            partition.ObjInst.on('Armed', () => {
                this.mainService.updateCharacteristic(this.Characteristic.SecuritySystemCurrentState, this.Characteristic.SecuritySystemCurrentState.AWAY_ARM);
            });
            partition.ObjInst.on('Disarmed', () => {
                this.NoAlarmState();
            });
            partition.ObjInst.on('HomeStay', () => {
                this.mainService.updateCharacteristic(this.Characteristic.SecuritySystemCurrentState, this.Characteristic.SecuritySystemCurrentState.STAY_ARM);
            });
            partition.ObjInst.on('HomeDisarmed', () => {
                this.NoAlarmState();
            });
            partition.ObjInst.on('ZoneOpen', () => {
                this.OccupancyService.updateCharacteristic(this.Characteristic.OccupancyDetected, 1);
            });
            partition.ObjInst.on('ZoneClosed', () => {
                this.OccupancyService.updateCharacteristic(this.Characteristic.OccupancyDetected, 0);
            });
        })
    }

    ActualArmedState(AsString = false, AsArray = false) {
        let ArmStatus = false;
        let HomeStatus = false;
        let DisarmStatus = false;
        if (!AsArray) {
            Object.values(this.DeviceInstance).forEach( partition => {
                ArmStatus = ArmStatus || partition.ObjInst.Arm;
                HomeStatus = HomeStatus || partition.ObjInst.HomeStay;
                DisarmStatus = DisarmStatus || (!partition.ObjInst.Arm && !partition.ObjInst.HomeStay);
            });
        } else {
            let ResultState = [];
            Object.values(this.DeviceInstance).forEach( partition => {
                let PState = this.Characteristic.SecuritySystemCurrentState.DISARMED;
                if (partition.ObjInst.Arm || partition.ObjInst.HomeStay) {
                    PState = (partition.ObjInst.Arm) ? this.Characteristic.SecuritySystemCurrentState.AWAY_ARM : PState;
                    PState = (partition.ObjInst.HomeStay && !partition.ObjInst.Arm) ? this.Characteristic.SecuritySystemCurrentState.STAY_ARM : PState;
                }
                ResultState.push(PState);
            });
            return ResultState;
        }
        if (AsString) {
            let PStateStr = 'Disarmed';
            if (ArmStatus || HomeStatus) {
                PStateStr = (ArmStatus) ? 'Away Armed' : PStateStr;
                PStateStr = (HomeStatus && !ArmStatus) ? 'Home Stay Armed' : PStateStr;
            }
            return PStateStr;
        } else {
            let PState = this.Characteristic.SecuritySystemCurrentState.DISARMED;
            if ( DisarmStatus && (ArmStatus || HomeStatus)) {
                PState = this.Characteristic.SecuritySystemCurrentState.STAY_ARM;
            } else if (ArmStatus || HomeStatus) {
                PState = (ArmStatus) ? this.Characteristic.SecuritySystemCurrentState.AWAY_ARM : PState;
                PState = (HomeStatus && !ArmStatus) ? this.Characteristic.SecuritySystemCurrentState.STAY_ARM : PState;
            }
            return PState;
        }
    }

    AlarmState() {
        let AlarmStatus = false;
        Object.values(this.DeviceInstance).forEach( partition => {
            AlarmStatus = AlarmStatus || partition.ObjInst.Alarm || partition.ObjInst.FalseCode || partition.ObjInst.Fire || partition.ObjInst.Panic || partition.ObjInst.Medic || partition.ObjInst.Arm;
        });
        if (AlarmStatus) {
            this.mainService.updateCharacteristic(this.Characteristic.SecuritySystemCurrentState, this.Characteristic.SecuritySystemCurrentState.ALARM_TRIGGERED);
            this.log.debug(`System "${this.name}" Alarm State`);
        }
    }

    NoAlarmState() {
        let AlarmStatus = false;
        Object.values(this.DeviceInstance).forEach( partition => {
            AlarmStatus = AlarmStatus || partition.ObjInst.Alarm || partition.ObjInst.FalseCode || partition.ObjInst.Fire || partition.ObjInst.Panic || partition.ObjInst.Medic || partition.ObjInst.Arm;
        });
        if (!AlarmStatus) {
            let PStateStr = this.ActualArmedState(true);
            let PState = this.ActualArmedState();
            this.log.debug(`System "${this.name}" Arming State : (${PState}) => ${PStateStr}`);
            this.mainService.updateCharacteristic(this.Characteristic.SecuritySystemCurrentState, PState);
        }
    }

    SetInitStatus() {
        this.mainService.updateCharacteristic(this.Characteristic.SecuritySystemCurrentState, this.ActualArmedState());
        let OccupancyStatus = false;
        OccupancyStatus = this.getOccupancyStatus();
        this.OccupancyService.updateCharacteristic(this.Characteristic.OccupancyDetected, ((OccupancyStatus) ? 1 : 0 ));

        if (this.IsMB) {
            this.BatteryService.updateCharacteristic(this.Characteristic.StatusLowBattery, ((this.DeviceMBInst.LowBatteryTrouble) ? 1 : 0));
            this.BatteryService.updateCharacteristic(this.Characteristic.BatteryLevel, ((this.DeviceMBInst.LowBatteryTrouble) ? 10 : 100));
        }
    }

    async setTargetState(state, callback) {
        try {
            const CanArm = function () {
                let OccupancyState = false;
                if (this.OccupancyPreventArming) {
                    OccupancyState = this.getOccupancyStatus();
                }
                let ReadyState = false;
                let TroubleState = false;
                Object.values(this.DeviceInstance).forEach( partition => {
                    ReadyState = ReadyState || partition.Ready;
                    TroubleState = TroubleState || partition.Trouble;
                });
                return (ReadyState && !TroubleState && !OccupancyState);
            }

            let ErrMsgArray = [];
            let PartStateArray = [];

            if (CanArm) {
                Object.values(this.DeviceInstance).forEach( async (PartObject) => {
                    let PartitionState = this.ActualArmedState(false, false);
                    switch (state) {
                        case this.Characteristic.SecuritySystemTargetState.STAY_ARM:
                            if (PartitionState !== state) {
                                if (PartitionState !== this.Characteristic.SecuritySystemCurrentState.DISARMED) {
                                    this.log.debug(`System is not Disarmed, We need to Disarm It before change Arming mode`);
                                    if (!(await PartObject.ObjInst.Disarm())) {
                                        ErrMsgArray.push(`System "${PartObject.name}" Cannot be Disarmed`);
                                    }
                                }
                                this.log.debug(`Setting "${PartObject.name}" state to (${state}) -> Stay Arm`);
                                if (await PartObject.ObjInst.HomeStayArm()) {
                                    PartStateArray.push(this.Characteristic.SecuritySystemCurrentState.STAY_ARM);
                                }
                            } else {
                                this.log.debug(`System "${PartObject.name}" is already Stay Armed`);
                            }
                            break;
                        case this.Characteristic.SecuritySystemTargetState.AWAY_ARM:
                            if (PartitionState !== state) {
                                if (PartitionState !== this.Characteristic.SecuritySystemCurrentState.DISARMED) {
                                    this.log.debug(`System is not Disarmed, We need to Disarm It before change Arming mode`);
                                    if (!await PartObject.ObjInst.Disarm()) {
                                        ErrMsgArray.push(`System "${PartObject.name}" Cannot be Disarmed`);
                                    }
                                }
                                this.log.debug(`Setting "${PartObject.name}" state to (${state}) -> Away Arm`);
                                if (await PartObject.ObjInst.AwayArm()) {
                                    PartStateArray.push(this.Characteristic.SecuritySystemCurrentState.AWAY_ARM);
                                }
                            } else {
                                this.log.debug(`System "${PartObject.name}" is already Away Armed`);
                            }
                            break;
                        case this.Characteristic.SecuritySystemTargetState.DISARM:
                            if (PartitionState !== state) {
                                this.log.debug(`Setting "${PartObject.name}" state to (${state}) -> Disarm`);
                                if (await PartObject.ObjInst.Disarm()) {
                                    PartStateArray.push(this.Characteristic.SecuritySystemCurrentState.DISARM);
                                }
                            } else {
                                this.log.debug(`System "${PartObject.name}" is already Disarmed`);
                            }
                        break;
                    }
                });
                Object.values(ErrMsgArray).forEach( ErrMsg => {
                    this.log.debug(ErrMsg);
                });
                if (PartStateArray.every( (partState) => partState === state )) {
                    this.mainService.updateCharacteristic(this.Characteristic.SecuritySystemCurrentState, state);
                    callback !== null && typeof callback === 'function' && callback(null);
                    return;
                } else if (PartStateArray.every( (partState) => partState === PartStateArray[0] )) {
                    this.mainService.updateCharacteristic(this.Characteristic.SecuritySystemCurrentState, PartStateArray[0]);
                    callback !== null && typeof callback === 'function' && callback(null);
                    return;
                } else {
                    this.mainService.updateCharacteristic(this.Characteristic.SecuritySystemCurrentState, this.Characteristic.SecuritySystemCurrentState.STAY_ARM);
                    const ErrMsg = `System Arming/Disarming "${this.name}" Not Succesfuly Executed`;
                    this.log.debug(ErrMsg);
                    callback !== null && typeof callback === 'function' && callback(ErrMsg);
                    return;
                }
            } else {
                const ErrMsg = `System "${this.name}" Not Ready`;
                this.log.debug(ErrMsg);
                callback !== null && typeof callback === 'function' && callback(ErrMsg);
                return;
            }
        } catch (err) {
            this.log.error(`Error on ${this.ClassName}/${this.getFunctionName()}:\n${err}`);
            callback !== null && typeof callback === 'function' && callback(err);
            return;
        }
    }

    getOccupancyStatus () {
        let OccupancyStatus = false;
        Object.values(this.DeviceInstance).forEach( partition => {
            OccupancyStatus = OccupancyStatus || partition.ObjInst.Open || !partition.ObjInst.Ready;
        });
        return OccupancyStatus;
    }

    getTargetState(callback) {
        try {
            let TState = this.ActualArmedState();
            callback(null, TState);
            return;
        } catch (err) {
            this.log.error(`Error on ${this.ClassName}/${this.getFunctionName()}:\n${err}`);
            this.mainService.updateCharacteristic(this.Characteristic.SecuritySystemTargetState, TState);
            callback(err);
            return;
        }
    }

    getCurrentState(callback) {
        try {
            let PStateStr = this.ActualArmedState(true);
            let PState = this.ActualArmedState();
            this.log.debug(`System "${this.name}" Arming State : (${PState}) => ${PStateStr}`);
            this.mainService.updateCharacteristic(this.Characteristic.SecuritySystemCurrentState, PState);
            callback(null, PState);
            return;
        } catch (err) {
            this.log.error(`Error on ${this.ClassName}/${this.getFunctionName()}:\n${err}`);
            this.mainService.updateCharacteristic(this.Characteristic.SecuritySystemCurrentState, PState);
            callback(err);
            return;
        }
    }

    getCurrentOccupancyState(callback) {
        let OccupancyStatus = false;
        try {
            OccupancyStatus = this.getOccupancyStatus();
            this.log.debug(`System "${this.name}" Occupancy State : (${OccupancyStatus}) => ${((OccupancyStatus) ? 'Occupied' : 'Not Occupied' )}`);
            this.OccupancyService.updateCharacteristic(this.Characteristic.OccupancyDetected, ((OccupancyStatus) ? 1 : 0 ));
            callback(null, (OccupancyStatus) ? 1 : 0);
            return;
        } catch (err) {
            this.log.error(`Error on ${this.ClassName}/${this.getFunctionName()}:\n${err}`);
            this.OccupancyService.updateCharacteristic(this.Characteristic.OccupancyDetected, ((OccupancyStatus) ? 1 : 0 ));
            callback(err);
            return;
        }
    }

    getFunctionName() {
        return (new Error()).stack.split('\n')[2].trim().match(/at [a-zA-Z]+\.([^ ]+)/)[1]
    }
}

module.exports = {
    RiscoCPPartitions: RiscoCPPartitions,
    RiscoCPSystem: RiscoCPSystem

}