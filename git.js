const fs = require("fs");

function Git() {
  this.__dirname = process.cwd();
  this.DEFAULT_BRANCH = "main";
}

Git.prototype.init = function init() {
  const parentDir = "./.gitClone";
  if (!fs.existsSync(parentDir)) {
    fs.mkdirSync(parentDir);
  }

  const nestedDirs = ["/refs", "/objects", "/refs/heads"];
  nestedDirs.forEach((d) => {
    if (!fs.existsSync(parentDir + d)) {
      fs.mkdirSync(parentDir + d, { recursive: true });
    }
  });

  fs.writeFileSync(
    parentDir + "/HEAD",
    this.getHeadRefStr(this.DEFAULT_BRANCH)
  );

  console.log(`Initialized empty repository in ${this.__dirname + parentDir}`);
};

Git.prototype.getHeadRefStr = function (branch) {
  return `ref: refs/heads/${branch}`;
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
