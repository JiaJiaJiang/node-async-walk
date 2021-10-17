const fsP=require('fs').promises;
const Path=require('path');

async function *readDirGenerator(path,infoType=''){
	let itemList=await fsP.readdir(path,{withFileTypes:infoType!=='fileStat'});
	if(infoType==='fileType'){//return dirent list
		for(let info of itemList){
			yield info;
		}
		return ;
	}
	if(infoType==='fileStat'){//return stats list with file name
		let tasks;
		let infoList;
		for(let tmpList;(tmpList=itemList.splice(0,50)).length;){//fetch a batch stats together
			tasks=[];
			for(let name of tmpList){
				tasks.push(fsP.stat(Path.join(path,name)).then(s=>{
					s.name=name;
					return s;
				}));
			}
			infoList=await Promise.all(tasks);//concat the result
			for(let info of infoList){
				yield info;
			}
		}
		return;
	}
	throw(new Error('Wrong infoType'));
}

/**
 *async generator for walk directory by filter
 *
 * @param {string} dirPath
 * @param {function(string,object)} filter filter function(dirPath, Dirent | Stats)
 * @param {object} [options={}]
 */
async function *walkFilterGenerator(dirPath,filter,options={}){
	dirPath=Path.resolve(dirPath);
	options=Object.assign({
		depth:Infinity,//scan depth
		exclude:[],//exclude sub-path in posix format
		types:['File','Directory','BlockDevice','CharacterDevice','FIFO','Socket','SymbolicLink'],//file type filter
		withStats:false,//include stats object in callback info
		// followSymbolicLink:true,
	},options);
	options.exclude=new Set(options.exclude.map(p=>Path.resolve(dirPath,p)));
	if(options.depth<1)throw(new Error('Wrong depth options: '+options.depth));
	let toWalk=[[dirPath,1]],//[subDir, depth],...
		asbPath,
		tmpDirs;//to concat to toWalk list
	for(let currentDir,depth,dir;dir=toWalk.shift();){//get a dir
		[currentDir,depth]=dir;
		tmpDirs=[];
		asbPath=Path.resolve(dirPath,currentDir);
		let infoGen=await readDirGenerator(asbPath,options.withStats?'fileStat':'fileType',options.types);
		for await(let info of infoGen){
			let name=info.name;
			asbPath=Path.resolve(dirPath,currentDir,name);
			if(options.exclude.has(asbPath))continue;//skip excluded path
			if(info.isDirectory()){
				//push to tmpDirs if this is a directory
				if((depth+1)<=options.depth){
					tmpDirs.push([Path.posix.join(currentDir,name),depth+1]);
				}
			}
			if(options.types?.length){
				let hit;
				for(let type of options.types){
					if(hit=info[`is${type}`]()){
						info.type=type;//mark file type
						break;
					}
				}
				if(!hit)continue;
			}
			if(filter(info)){
				yield [currentDir,info];
			}
		}
		toWalk=tmpDirs.concat(toWalk);
	}
}
/**
 *async generator for walk directory by regExp
 *
 * @param {string} dirPath
 * @param {RegExp} regExp 
 * @param {object} [options={}]
 */
function walkRegExpGenerator(dirPath,regExp,callback,options){
	return walkFilterGenerator(dirPath,info=>{
		return regExp.test(info.name);
	},callback,options);
}

/**
 *for directly called walker
 *
 * @param {Generator} gen
 * @param {function} callback callback(subDir, Dirent | Stats)
 * @param {object} options
 */
async function generatorWrapper(gen,callback,options){
	options=Object.assign({
		asyncCallbackInParallel:false,//call async callback function in parallel (not wait them before the walker ends)
	},options);
	const callbackTasks=[];//callback tasks
	if(options.asyncCallbackInParallel){
		for await(let [dir,info] of gen){
			callbackTasks.push(callback(dir,info));
		}
	}else{
		for await(let [dir,info] of gen){
			await callback(dir,info);
		}
	}
	if(callbackTasks.length)await Promise.all(callbackTasks);
}

/**
 *walk directory by filter
 *
 * @param {string} dirPath
 * @param {function(string,object)} filter filter function(dirPath, Dirent | Stats)
 * @param {function} callback callback(subDir, Dirent | Stats)
 * @param {object} options
 */
async function walkFilter(dirPath,filter,callback,options){
	let gen=walkFilterGenerator(dirPath,filter,options);
	await generatorWrapper(gen,callback,options);
}

/**
 *walk directory by filter
 *
 * @param {string} dirPath
 * @param {RegExp} regExp 
 * @param {function} callback callback(subDir, Dirent | Stats)
 * @param {object} options
 */
async function walkRegExp(dirPath,regExp,callback,options){
	let gen=walkRegExpGenerator(dirPath,regExp,options);
	await generatorWrapper(gen,callback,options);
}

module.exports={
	walkFilterGenerator,
	walkRegExpGenerator,
	walkRegExp,
	walkFilter,
}
