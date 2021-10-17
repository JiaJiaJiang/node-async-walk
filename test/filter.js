const {walkFilter}=require('../index.js');
walkFilter(__dirname+'/..',info=>{
	if(info.size>2048)return true;//get file which size > 2048 Bytes
},(dir,info)=>{
	console.log(info.type,'\t',dir,info.name,info.size);
},{
	withStats:true,//include stats object in callback info
});