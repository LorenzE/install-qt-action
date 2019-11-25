import * as process from "process";
import * as glob from "glob";
import * as core from '@actions/core';
import * as exec from '@actions/exec';

async function run() {
  try {
    // 7-zip is required, and not included on macOS
    if (process.platform == "darwin") {
      await exec.exec("brew install p7zip")
    }

    // Qt installer assumes basic requirements that are not installed by
    // default on Ubuntu.
    if (process.platform == "linux" && core.getInput("install-deps") == "true") {
      await exec.exec("sudo apt-get install build-essential libgl1-mesa-dev -y")
    }

    await exec.exec("pip3 install setuptools wheel");
    await exec.exec("pip3 install \"aqtinstall==0.6.*\" --pre");

    const dir = (core.getInput("dir") || process.env.RUNNER_WORKSPACE) + "/Qt";
    const version = core.getInput("version");
    let host = core.getInput("host");
    let target = core.getInput("target");
    let arch = core.getInput("arch");
    let modules = core.getInput("modules");

    //set host automatically if omitted
    if (!host) {
      switch(process.platform) {
        case "win32": {
            host = "windows";
            break;
        }
        case "darwin": {
            host = "mac";
            break;
        }
        default: {
            host = "linux";
            break;
        }
      }
    }

    //set arch automatically if omitted
    if (!arch) {
      if (host == "windows") {
        arch = "win64_msvc2017_64";
      } else if (host == "android") {
        arch = "android_armv7";
      }
    }

    //set args
    let args = ["-O", `${dir}`, `${version}`, `${host}`, `${target}`];
    if (arch) {
      args.push(`${arch}`);
    }
    if (modules) {
      args.push(`-m ${modules}`);
    }

    //accomodate for differences in python 3 executable name
    let pythonName = "python3";
    if (process.platform == "win32") {
      pythonName = "python";
    }

    //run aqtinstall with args
    await exec.exec(`${pythonName} -m aqt install`, args);

    //set environment variables
    let qtPath = dir + "/" + version;
    qtPath = glob.sync(qtPath + '/**/*')[0];

    core.exportVariable('Qt5_Dir', qtPath);
    core.addPath(qtPath + "/bin");
    
    // If on windows automatically download and setup jom compiler
    if (process.platform == "win32") {
      await exec.exec("npm install download-file --save");

      var download = require('download-file') 
      var url = "http://download.qt.io/official_releases/jom/jom.zip"      
      var options = {
          directory: qtPath + "\bin",
          filename: "jom.zip"
      }      
      download(url, options, function(err){
          if (err) throw err
          console.log("Download jom.zip")
      }) 
      await exec.exec('expand-archive -path "$Env:Qt5_Dir\jom.zip" -destinationpath "$Env:Qt5_Dir\bin"')
    }
  } catch (error) {
    core.setFailed(error.message);
  }
}

run();