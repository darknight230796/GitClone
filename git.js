const fs = require("fs");

const ROOT_DIR = "./.gitClone";
const HASH_LENGTH = 32;
function Git() {
  this.__dirname = process.cwd();
  this.DEFAULT_BRANCH = "main";
}

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

  fs.writeFileSync(ROOT_DIR + "/HEAD", this.getHeadRefStr(this.DEFAULT_BRANCH));

  console.log(`Initialized empty repository in ${this.__dirname + ROOT_DIR}`);
};

Git.prototype.getHeadRefStr = function (branch) {
  return `ref: refs/heads/${branch}`;
};

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
    const hashedContent = this.hashContent(fileContent);
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

Git.prototype.hashContent = function (content) {
  let key = "";
  for (let i = 0; i < content.length; i++) {
    key += content.charCodeAt(i).toString(16);
  }
  return (key + "0000").slice(0, HASH_LENGTH);
};

function getCurrentCommit() {
  const headContent = fs.readFileSync(ROOT_DIR + "/HEAD", "utf8");
  const isDetachedHead = headContent?.indexOf("ref") === -1;
  const refLink = ROOT_DIR + "/" + headContent.split(" ")[1];

  const currentCommit =
    (isDetachedHead
      ? headContent
      : fs.existsSync(refLink)
      ? fs.readFileSync(refLink)
      : null) ?? null;

  return currentCommit;
}

Git.prototype.commit = function (flag, message) {
  const headContent = fs.readFileSync(ROOT_DIR + "/HEAD", "utf8");
  const isDetachedHead = headContent?.indexOf("ref") === -1;
  const refLink = ROOT_DIR + "/" + headContent.split(" ")[1];

  const parentCommit = getCurrentCommit();

  const commitContent = `${message}\n${
    parentCommit ? `parent:${parentCommit}` : ""
  }`;
  const commitId = this.hashContent(commitContent);

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
};

function catFile(hashId) {
  const uri =
    ROOT_DIR +
    "/objects/" +
    hashId.slice(0, 2) +
    "/" +
    hashId.slice(2, HASH_LENGTH);
  return fs.existsSync(uri) ? fs.readFileSync(uri, "utf8") : null;
}

Git.prototype["cat-file"] = function (hashId) {
  console.log(catFile(hashId));
};

function gitLog(commitId) {
  let currentCommit = commitId ?? getCurrentCommit();
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
