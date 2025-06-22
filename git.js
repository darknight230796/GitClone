const fs = require("fs");
const path = require("path");

const ROOT_DIR = "./.gitClone";
const HASH_LENGTH = 32;
function Git() {
  this.__dirname = process.cwd();
  this.DEFAULT_BRANCH = "main";
}

const hashContent = function (content) {
  let key = "";
  for (let i = 0; i < content.length; i++) {
    key += content.charCodeAt(i).toString(16);
  }
  while (key.length > HASH_LENGTH) {
    // const firstHalf = key.slice(0, Math.floor(key.length - 1) / 2);
    // const secondHalf = key.slice(Math.ceil(key.length - 1) / 2, key.length);

    // key = (
    //   BigInt(parseInt(firstHalf, 16)) + BigInt(parseInt(secondHalf, 16))
    // ).toString(16);
    let tempKey = "";
    for (let i = 0; i < key.length; i += 4) {
      let sum = 0;
      for (let j = 0; j < 4; j++) {
        sum += parseInt(key[i + j] ?? 0, 16);
      }
      tempKey += sum.toString(16);
    }
    key = tempKey;
  }
  return (key + "0000").slice(0, HASH_LENGTH);
};

Git.prototype.init = function init() {
  if (!fs.existsSync(ROOT_DIR)) {
    fs.mkdirSync(ROOT_DIR);
  }

  const nestedDirs = ["/refs", "/objects", "/refs/heads"];
  nestedDirs.forEach((d) => {
    if (!fs.existsSync(ROOT_DIR + d)) {
      fs.mkdirSync(ROOT_DIR + d, { recursive: true });
    }
  });

  fs.writeFileSync(ROOT_DIR + "/HEAD", getHeadRefStr(this.DEFAULT_BRANCH));

  console.log(`Initialized empty repository in ${this.__dirname + ROOT_DIR}`);
};

function getHeadRefStr(branch) {
  return `ref: refs/heads/${branch}`;
}

function createObject(id, content) {
  const objectPath =
    ROOT_DIR + `/objects/${id.slice(0, 2)}/${id.slice(2, HASH_LENGTH)}`;

  if (!fs.existsSync(ROOT_DIR + `/objects/${id.slice(0, 2)}`)) {
    fs.mkdirSync(ROOT_DIR + `/objects/${id.slice(0, 2)}`);
  }

  fs.writeFile(objectPath, content, (err) => {
    if (err) {
      throw err;
    }
  });
}

Git.prototype.add = async function (path) {
  if (!path) {
    throw new Error("path is required");
  }
  const pathToIndex = ROOT_DIR + "/INDEX";
  if (!fs.existsSync(pathToIndex)) {
    fs.writeFileSync(pathToIndex, "");
  }
  let indexContent = fs.readFileSync(pathToIndex, "utf8");
  const isFile = Boolean(path.split(".")[1]);

  const addFile = (pathToFile) => {
    const fileContent = fs.readFileSync(pathToFile, "utf8");
    const hashedContent = hashContent(fileContent);
    const hashFromIndex = indexContent
      .split("\n")
      .find((entry) => entry.includes(pathToFile))
      ?.split(" ")[0];
    if (hashFromIndex === hashedContent) {
      return;
    }
    if (!hashFromIndex) {
      indexContent += `\n${hashedContent} 0 ${pathToFile}`;
    } else if (hashFromIndex !== hashedContent) {
      indexContent = indexContent.replace(hashFromIndex, hashedContent);
    }

    createObject(hashedContent, fileContent);
  };

  if (isFile) {
    addFile(path);
  } else {
    fs.readdirSync(path).forEach((file) => {
      addFile(path + "/" + file);
    });
  }
  fs.writeFileSync(pathToIndex, indexContent);
};

function getCurrentCommitID() {
  const headContent = fs.readFileSync(path.join(ROOT_DIR, "HEAD"), "utf8");
  const isDetachedHead = headContent?.indexOf("ref") === -1;
  const refLink =
    !isDetachedHead && path.join(ROOT_DIR, headContent.split(" ")[1]);

  const currentCommit =
    (isDetachedHead
      ? headContent
      : fs.existsSync(refLink)
      ? fs.readFileSync(refLink, "utf-8")
      : null) ?? null;

  return currentCommit;
}

const createDirectoryTree = (rootPath) => {
  let rootContent = "";

  fs.readdirSync(rootPath).forEach((item) => {
    if (item === ".gitClone") {
      return;
    }
    const itemPath = path.join(rootPath, item);
    const stats = fs.statSync(itemPath);
    if (stats.isFile()) {
      const hashFile = hashContent(fs.readFileSync(itemPath, "utf-8"));
      rootContent += `\nblob:${hashFile}:${item}`;
    } else {
      const hashDir = createDirectoryTree(itemPath);
      rootContent += `\ntree:${hashDir}:${item}`;
    }
  });

  const rootHash = hashContent(rootContent);
  console.log(rootHash, rootContent);

  createObject(rootHash, rootContent);

  return rootHash;
};

Git.prototype.commit = function (_flag, message) {
  const headContent = fs.readFileSync(ROOT_DIR + "/HEAD", "utf8");
  const isDetachedHead = headContent?.indexOf("ref") === -1;
  const refLink =
    !isDetachedHead && path.join(ROOT_DIR, headContent.split(" ")[1]);

  // create root tree

  const rootHash = createDirectoryTree(this.__dirname);

  const parentCommit = getCurrentCommitID();

  const commitContent = `${message}\n${
    parentCommit ? `parent:${parentCommit}` : ""
  }\ntree:${rootHash}`;

  const commitId = hashContent(commitContent);

  if (commitId === parentCommit) {
    console.log("Nothing to commit");
    return;
  }

  fs.writeFile(
    isDetachedHead ? ROOT_DIR + "/HEAD" : refLink,
    commitId,
    (err) => {
      if (err) {
        throw err;
      }
    }
  );

  createObject(commitId, commitContent);

  console.log("created new commit: ", commitId);
};

function getObjectPath(hashID) {
  return path.join(
    ROOT_DIR,
    "objects",
    hashID.slice(0, 2),
    hashID.slice(2, HASH_LENGTH)
  );
}

function catFile(hashId) {
  const uri = getObjectPath(hashId);
  return fs.existsSync(uri) ? fs.readFileSync(uri, "utf8") : null;
}

Git.prototype["cat-file"] = function (hashId) {
  console.log(catFile(hashId));
};

function gitLog(commitId) {
  let currentCommit = commitId ?? getCurrentCommitID();
  if (currentCommit) {
    console.log(`commit: ${currentCommit}`);
    const content = catFile(currentCommit);
    const [message, ...parent] = content.split("\n");
    console.log(message);
    console.log("\n");
    parent?.forEach((p) => {
      gitLog(p.split(":")[1]);
    });
  }
}

function branchExists(branchName) {
  return fs.existsSync(path.join(ROOT_DIR, "refs", "heads", branchName));
}

function getRootTreeFromCommitID(commitId) {
  const content = fs.existsSync(getObjectPath(commitId))
    ? fs.readFileSync(getObjectPath(commitId), "utf-8")
    : null;

  if (content) {
    return content
      .split("\n")
      .find((item) => item.includes("tree"))
      ?.split(":")?.[1];
  }
}

function createDirectoryMap(hashId) {
  return catFile(hashId)
    ?.split("\n")
    ?.reduce((acc, file) => {
      const [type, hash, name] = file.split(":");
      if (type && hash && name) {
        Object.assign(acc, { [name]: { hash, type } });
      }
      return acc;
    }, {});
}

function updateFiles(sourceTree, targetTree) {
  if (sourceTree === targetTree) {
    return;
  }

  const sourceMap = createDirectoryMap(sourceTree);
  /// Todo: update source with target
}

Git.prototype.checkout = function (target) {
  const currentCommit = getCurrentCommitID();
  let targetCommit;
  const isCommit = catFile(target);
  if (isCommit !== null) {
    fs.writeFileSync(path.join(ROOT_DIR, "HEAD"), target);
    targetCommit = target;
    console.log("Git is now in DETACHED HEAD mode.");
  } else if (branchExists(target)) {
    fs.writeFileSync(path.join(ROOT_DIR, "HEAD"), getHeadRefStr(target));
    targetCommit = fs.readFileSync(
      path.join(ROOT_DIR, "refs", "heads", target),
      "utf8"
    );
    console.log("switched to branch: " + target);
  } else {
    console.log("branch does not exists.");
  }
  const currentTree = getRootTreeFromCommitID(currentCommit);
  const targetTree = getRootTreeFromCommitID(targetCommit);
  updateFiles(currentTree, targetTree);
};

Git.prototype.log = function (commitId) {
  gitLog();
};

(function main() {
  const git = new Git();
  const method = process.argv[2];
  const arguments = process.argv.slice(3);
  try {
    git[method](...arguments);
  } catch (e) {
    console.log(e);
  }
})();
