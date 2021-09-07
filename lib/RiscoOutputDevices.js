'use strict';

class RiscoCPOutputs {
    constructor(log, accConfig, api, accessory) {
        this.ClassName = this.constructor.name;
        this.log = log;
        this.name = accConfig.context.name;
        this.RiscoSession = accConfig.RiscoSession;
        this.RiscoOutputId = accConfig.context.Id;
        this.DeviceInstance = accConfig.context.ObjInst;
        this.PulseDelay = this.DeviceInstance.PulseDelay;
        this.accessory = accessory;
        this.api = api;

        this.Service = this.api.hap.Service;
        this.Characteristic = this.api.hap.Characteristic;
        this.mainService = this.accessory.getService(this.Service.Switch, this.accessory.displayName);
        
        this.mainService
            .getCharacteristic(this.Characteristic.On)
            .on('get', this.getCurrentState.bind(this))
            .on('set', this.setTargetState.bind(this));

        this.IsPulsed = false;
        
        //avoid maxlistener warning
        const MaxApiListeners = this.api.getMaxListeners();
        const ActualListeners = this.api.listenerCount('shutdown');
        this.log.debug(`Api Event Shutdown : \nActual Listener :${this.api.listenerCount('shutdown')} for Maximum :${MaxApiListeners}`);
        if (ActualListeners >= MaxApiListeners) {
            //give one more for other process
            this.api.setMaxListeners(ActualListeners + 2);
            this.log.debug(`Max Listener Exceeded. Set To :${(ActualListeners + 2)}`);
        }

        this.api.once('shutdown', () => {
            this.log.debug(`Cleaning Before Exit.\nRemove All Listeners for ${this.name}`);
            this.mainService
                .getCharacteristic(this.Characteristic.On)
                .removeListener('get', this.getCurrentState)
                .removeListener('set', this.setTargetState);
        });

        this.DeviceInstance.on('Actived', () => {
            this.mainService.updateCharacteristic(this.Characteristic.On, this.DeviceInstance.Active);
        });
        this.DeviceInstance.on('Deactived', () => {
            this.mainService.updateCharacteristic(this.Characteristic.On, this.DeviceInstance.Active);
        });
        this.DeviceInstance.on('Pulsed', () => {
            this.mainService.updateCharacteristic(this.Characteristic.On, true);
            setTimeout(this.ResetPulseSwitchState, this.PulseDelay, this);
        });

        this.mainService.updateCharacteristic(this.Characteristic.On, this.DeviceInstance.Active);
    }

    async getCurrentState(callback) {
        try {
            this.log.debug(`Output "${this.name}" Active State : (${this.DeviceInstance.Active}) => ${(this.DeviceInstance.Active) ? 'Active': 'Inactive'}`);
            callback(null, this.DeviceInstance.Active);
            return;
        } catch (err) {
            this.log.error(`Error on ${this.ClassName}/${this.getFunctionName()}:\n${err}`);
            this.mainService.updateCharacteristic(this.Characteristic.On, this.DeviceInstance.Active);
            callback(err);
            return;
        }
    }

    async setTargetState(state, callback) {
        try {
            if (this.DeviceInstance.Pulsed) {
                if (this.IsPulsed) {
                    this.log.debug('Pulse switch is already pulsed');
                    this.IsPulsed = false;
                    typeof callback === 'function' && callback(null);
                } else {
                    this.log.debug('Pulse switch is not already pulsed');
                    this.IsPulsed = true;
                    await this.DeviceInstance.ToggleOutput();
                    typeof callback === 'function' && callback(null);
                }
            } else {
                this.log.debug('Not a pulse switch, update it')
                await this.DeviceInstance.ToggleOutput();
                this.mainService.updateCharacteristic(this.Characteristic.On, this.DeviceInstance.Active);
                typeof callback === 'function' && callback(null);
            }
        } catch (err) {
            this.log.error(`Error on ${this.ClassName}/${this.getFunctionName()}:\n${err}`);
            this.mainService.updateCharacteristic(this.Characteristic.On, this.DeviceInstance.Active);
            callback(err);
            return;
        }
    }

    async ResetPulseSwitchState(self) {
        self.log.debug(`Reset Pulse Switch State to ${self.DeviceInstance.Active}`);
        self.mainService.updateCharacteristic(self.Characteristic.On, self.DeviceInstance.Active);
        self.IsPulsed = false;
    }

    getFunctionName() {
        return (new Error()).stack.split('\n')[2].trim().match(/at [a-zA-Z]+\.([^ ]+)/)[1]
    }
}

module.exports = {
    RiscoCPOutputs: RiscoCPOutputs,
}