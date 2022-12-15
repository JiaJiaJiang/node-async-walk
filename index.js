const fsP=require('fs').promises;
const Path=require('path');

/**
 *generator for reading dir
 *
 * @param {string} path
 * @param {'fileStat'|'fileType'} [infoType='']
 * @yields {Dirent|Stat}  
 * @returns {*}  
 */
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
 * @param {function(string,object)|RegExp} filter filter function(dirPath, Dirent | Stats)
 * @param {object} [options={}]
 */
async function *walkFilterGenerator(dirPath,filter,options={}){
	if(filter instanceof RegExp){
		const regExp=filter;
		filter=(dir,info)=>regExp.test(info.name);
	}else if(typeof filter !== 'function'){
		throw(new TypeError('wrong filter type'));
	}
	dirPath=Path.resolve(dirPath);
	options=Object.assign({
		depth:Infinity,//scan depth
		exclude:[],//exclude sub-path in posix format
		types:['File','Directory','BlockDevice','CharacterDevice','FIFO','Socket','SymbolicLink'],//file type filter
		withStats:false,//include stats object in callback info,
		onDirectory:dir=>{return true},
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
		if(currentDir===dirPath)currentDir='.';
		if(!options.onDirectory(currentDir))continue;
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
			if(filter(currentDir,info)){
				yield [currentDir,info];
			}
		}
		toWalk=tmpDirs.concat(toWalk);
	}
}

/**
 *for directly called walker
 *
 * @param {Generator} gen
 * @param {function} callback callback(subDir, Dirent | Stats)
 * @param {object} options
 * @param {boolean|number} options.asyncCallbackInParallel false to disable,number to set parallel tasks,true to run all tasks together
 */
async function generatorWrapper(gen,callback,options){
	options=Object.assign({
		asyncCallbackInParallel:false,//call async callback function in parallel (not wait them before the walker ends)
	},options);
	let inParallel=options.asyncCallbackInParallel;
	if(inParallel===false||inParallel===undefined){
		for await(let [dir,info] of gen){
			await callback(dir,info);
		}
	}else if((typeof inParallel ==='number') || inParallel===true){
		if(inParallel<=0)throw(new Error('wrong options.asyncCallbackInParallel: '+inParallel));
		if(inParallel===true)inParallel=Infinity;
		const callbackTasks=new Set;//callback tasks
		for await(let [dir,info] of gen){
			const p=callback(dir,info);
			callbackTasks.add(p);
			if(callbackTasks.size<inParallel){
				continue;
			}
			await (Promise.race(callbackTasks)//continue when any task done or failed
				.then(()=>{})
				.catch((err)=>console.error(err))
				.finally(()=>{
					callbackTasks.delete(p);//delete current task's promise
				}));
		}
		//consume the rest
		if(callbackTasks.size)await Promise.allSettled(callbackTasks);
	}
}

/**
 *walk directory by filter
 *
 * @param {string} dirPath
 * @param {function(string,object)|RegExp} filter filter function(dirPath, Dirent | Stats)
 * @param {function} callback callback(subDir, Dirent | Stats)
 * @param {object} options
 */
async function walkFilter(dirPath,filter,callback,options){
	let gen=walkFilterGenerator(dirPath,filter,options);
	await generatorWrapper(gen,callback,options);
}


module.exports={
	walkFilterGenerator,
	walkFilter,
}
