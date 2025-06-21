const fs = require("fs");

const ROOT_DIR = "./.gitClone";
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
    const objectPath =
      ROOT_DIR +
      `/objects/${hashedContent.slice(0, 2)}/${hashedContent.slice(2, 16)}`;

    if (!fs.existsSync(ROOT_DIR + `/objects/${hashedContent.slice(0, 2)}`)) {
      fs.mkdirSync(ROOT_DIR + `/objects/${hashedContent.slice(0, 2)}`);
    }

    fs.writeFile(objectPath, fileContent, (err) => {
      if (err) {
        throw err;
      }
    });
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
  return (key + "0000").slice(0, 16);
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
