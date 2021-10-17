# node-async-walk
Useful directory walker

## Install

```bash
npm i async-walk
```

## Parameters

#### Walk options

```javascript
let walkOptions={//these are default values
    //scan depth, minimal value is 1
    depth:Infinity,
    
    //exclude sub-path in posix format, e.g. 'a/b/c'
    exclude:[],
    
    //call async callback function in parallel (not wait them before the walker ends)
    //not working in async generator mode
    asyncCallbackInParallel:false,
    
    //file type filter
    types:['File','Directory','BlockDevice','CharacterDevice','FIFO','Socket','SymbolicLink'],
    
    //use Stats object instead of Dirent object in callback info
    withStats:false,
}
```

#### callback(subDir,info)

* subDir : Path relative to given directory path. This is the path of sub directory where the file in, not including file name.
* info : If `walkOptions.withStats` is true, this will be a [Stats object](https://nodejs.org/api/fs.html#fs_class_fs_stats), otherwise this will be a [Dirent Object](https://nodejs.org/api/fs.html#fs_class_fs_dirent). Additional properties are:
  * name : File name.
  * type : Type of this file, the same as which in `walkOptions.types`.

## Usage

There are two modes you can use: `callback mode` and `async generator mode`. With `async generator mode`, you can break at where you want in `for await`.

#### Filter by RegExp

------

#### async function walkRegExp(path,regexp,callback[,options])

```javascript
const {walkRegExp}=require('async-walk');

walkRegExp(__dirname+'/..', /\.js$/, (dir,info)=>{//walk js files
    console.log(info.type, '\t', dir, info.name);
}, walkOptions);
```

#### async function* walkRegExpGenerator(path,regexp[,options])

```javascript
const {walkRegExpGenerator}=require('async-walk');
(async ()=>{
    //get the generator
    let gen=walkRegExpGenerator(__dirname+'/..', /.*/, {//options example
        depth:2,//limit scan depth to 2
        exclude:['.git'],//ignore '.git' directory and its children
        types:['File','Directory'],
        withStats:true,
    });
    
    //use 'for await' for async generator and you can break at where you want
    for await(let [dir,info] of gen){
        console.log(info.type, '\t', dir, info.name);
        if(info.name === 'poi')break;//break when find a file named 'poi'
    }
})();
```



#### Filter by filter function

------

#### async function walkFilter(path,filter,callback[,options])

```javascript
const {walkFilter}=require('async-walk');
walkFilter(__dirname+'/..', info=>{//filter function
    if(info.size > 2048)return true;//filter file whose size > 2048 Bytes
}, (dir,info)=>{//callback
    console.log(info.type, '\t', dir, info.name, info.size);
}, {//options
    withStats:true,//use Stats object so we can get file size for filter
});
```

#### async function* walkFilterGenerator(path,filter[,options])

```javascript
const {walkRegExpGenerator}=require('async-walk');
(async ()=>{
    //get the generator
    let gen=walkFilterGenerator(__dirname+'/..', info=>{//filter function
        if(info.size > 2048)return true;//filter file whose size > 2048 Bytes
    }, {//options example
        withStats:true,//use Stats object so we can get file size for filter
    });
    
    //use 'for await' for async generator and you can break at where you want
    for await(let [dir,info] of gen){
        console.log(info.type,'\t', dir, info.name);
    }
})();
```



#### Other Examples

------

#### Parallel async callback

```javascript
const {walkFilter}=require('async-walk');

walkFilter(__dirname+'/..', info=>{
    if(info.size > 2048)return true;//get file which size > 2048 Bytes
},async (dir,info)=>{
    return new Promise((ok,fail)=>{
        setTimeout(()=>{//set a random timout,in parallel mode the log will print in random order
            console.log(info.type, '\t', dir, info.name, info.size);
            ok();
        },5000*Math.random());
    })
},{
    withStats:true,//use Stats object so we can get file size for filter
    asyncCallbackInParallel:true,
});
```
