const {walkFilterGenerator}=require('../index.js');
(async ()=>{
	let gen=walkFilterGenerator(__dirname+'/..',/.*/,{
		depth:2,//scan depth
		exclude:[],//exclude sub-path in posix format
		asyncCallbackInParallel:false,//call async callback function in parallel (not wait them before the walker ends)
		types:['File','Directory','BlockDevice','CharacterDevice','FIFO','Socket','SymbolicLink'],//file type filter
		withStats:true,//include stats object in callback info
	});
	for await(let [dir,info] of gen){
		console.log(info.type,'\t',dir,info.name);
	}
})();