process.on('uncaughtException', function (err) {
  console.log(err);
})
module.exports = class PCA9536{
	constructor(addr, config, comm){
		this.data = config;
		this.comm = comm;
		this.addr = addr;
		this.settable = ['all', 'channel_1', 'channel_2', 'channel_3', 'channel_4'];
		this.initilized = false;
		this.init();
	}

	init(){
		//try{
			this.iodir = 0;
			this.data.ios = {};

			for(var i=4;i>0;i--){
				this.iodir = (this.iodir << 1) | (this.data["io_"+i] ? 0 : 1);
				this.data.ios[i] = this.data["io_"+i] ? 1 : 0;
			}
			Promise.all([
				this.comm.writeBytes(this.addr, 0x02, this.iodir),
				this.comm.writeBytes(this.addr, 0x03, this.iodir)
			]).then((r) => {
				this.initialized = true;
			}).catch((e) => {
				console.log(e);
				this.initialized = false;
			});

		// }catch(e){
		// 	console.log({'failed to initialize': e});
		// 	this.initialized = false;
		// }
	}
	get(){
		var sensor = this;
		return new Promise((fulfill, reject) => {
			Promise.all([
				sensor.comm.readByte(sensor.addr, 0),
				sensor.comm.readByte(sensor.addr, 1)
			]).then((res) => {
				sensor.input_status = res[0];
				sensor.output_status = res[1];
				fulfill(sensor.parseStatus());
			}).catch((e) => {
				sensor.initialized = false;
				reject(e);
			});
		});
	}
	parseStatus(){
		var ios = this.data.ios,
			readings = {};
		for(var i in ios){
			if(ios[i] == 1) readings["channel_"+i] = this.output_status & (1 << (i-1)) ? 1 : 0;
			else readings["channel_"+i] = this.input_status & (1 << (i-1)) ? 1 : 0;
		}
		return readings;
	}
	set(topic, value){
		var sensor = this;
		return new Promise((fulfill, reject) => {
				function uninit(e){
					sensor.initialized = false;
					reject(e);
				}
				var status = sensor.output_status;
				if(topic == 'all'){
					if(status != value){
						sensor.output_status = value;
						sensor.comm.writeBytes(this.addr, 0x01, value).then(fulfill(sensor.parseStatus())).catch(uninit);
					}else{
						fulfill(res);
					}
				}else{
					var channel = topic.split('_')[1];
					if(value == 1){
						status |= (1 << (channel-1));
					}else if(value == 2){
						status ^= (1 << (channel-1));
					}else{
						status &= ~(1 << (channel - 1));
					}
					if(sensor.output_status != status){
						sensor.output_status = status;
						sensor.comm.writeBytes(sensor.addr, 0x01, status).then(fulfill(sensor.parseStatus())).catch(uninit);
					}else{
						fulfill(sensor.parseStatus());
					}
				}
		});
	}
}
