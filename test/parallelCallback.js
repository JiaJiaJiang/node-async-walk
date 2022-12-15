const {walkFilter}=require('../index.js');
console.log('get file which size > 2048 Bytes in parallel with a random timeout');
console.log('this list should be in different order for each run');

walkFilter(__dirname+'/..',(dir,info)=>{
	if(info.size>2048)return true;//get file which size > 2048 Bytes
},async (dir,info)=>{
	return new Promise((ok,fail)=>{
		setTimeout(()=>{//set a random timout,in parallel mode the log will print in random order
			console.log(info.type,'\t',dir,info.name,info.size);
			ok();
		},5000*Math.random());
	})
},{
	withStats:true,//include stats object in callback info
	asyncCallbackInParallel:true,
});