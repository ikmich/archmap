import FS from 'fs';
import Path from 'path';

/*
 * ++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
 * ++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
 * ++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
 * ++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
 */

/**
 * Structure of a task in the software system.
 */
export interface TaskDef<T> {
  scope?: string;
  name: string;
  summary?: string | string[];
  fn?: (refTask: TaskDef<T>) => T | unknown;

  /**
   * An optional list of items to take note of. This can be used to capture different kinds of items, ranging from
   * acceptance criteria to implementation conditions and etc.
   */
  notes?: string[];
  meta?: Record<string, any>;
  concerns?: string[];
  assumptions?: string[];
  questions?: string[];

  /**
   * Parent task for which this task will be a subTask.
   */
  parent?: TaskDef<any>;

  weight?: number;

  ticketed?: boolean;

  [k: string]: any;
}

export interface ArchInitOpts {
  outputsDir?: string;
  name: string;
  description?: string;
  task: TaskDef<any>;
}

/*
 * ++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
 * ++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
 * ++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
 * ++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
 */

let outputDir: string, scopedOutputsDir: string;
let files: any = {
  tasks: ''
};

const DEFAULT_OUTPUT_DIR = Path.join(process.cwd(), 'archmap-outputs/');

function initOutputDir() {
  if (!outputDir) {
    outputDir = DEFAULT_OUTPUT_DIR;
  }

  // Reset the output dir by deleting and recreating it.
  fileService.resetDir(outputDir);

  scopedOutputsDir = Path.join(outputDir, 'scope-tasks/');
  fileService.ensureDir(scopedOutputsDir);

  files.tasks = Path.join(outputDir, 'tasks.json');
}

/*
 * ++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
 * ++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
 * ++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
 * ++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
 */

/**
 * Marks the start of the architecture flow. This has to be called so the library knows when to reset the output
 * directory. If it's not called, the new tasks output logs will be appended to the old tasks output logs.
 * @param initOptions
 */
export function initArch<T>(initOptions: ArchInitOpts) {
  if (initOptions.outputsDir) {
    outputDir = initOptions.outputsDir;
  }
  initOutputDir();
  task(initOptions.task);
}

/**
 * Executes a task in the software system.
 * @param task
 */
function task<O>(task: TaskDef<O>): O | unknown {
  if (!task.fn) {
    task.fn = () => undefined as unknown;
  }

  let taskRecords: TaskDef<any>[] = taskStore.getAll();

  let parentFound = false;
  if (task.parent) {
    // find parent task.
    for (let taskRecord of taskRecords) {
      const nameMatch = taskRecord.name === task.parent.name;
      const scopeMatch = taskRecord.scope === task.parent.scope;

      if (nameMatch && scopeMatch) {
        parentFound = true;

        if (!taskRecord.subTasks) {
          taskRecord.subTasks = [];
        }

        /* We don't want the whole parent task object to be rendered. We will delete it, and add a 'parentName' string
         * property instead. */
        delete task.parent;

        // [hack the keys order so that 'parentName' will be the first property]
        const taskCopy = Object.assign({}, task);
        const originalKeys = Object.keys(task);
        for (let k of originalKeys) delete task[k];

        // set 'parentName' property.
        task.parentName = taskRecord.name;
        for (let k of originalKeys) task[k] = taskCopy[k];

        taskRecord.subTasks.push(task);
        break;
      }
    }
  }

  if (parentFound) {
    taskStore.saveMany(taskRecords);
  } else {
    taskStore.saveOne(task);
  }

  /* [Save scope tasks] */
  const scopedTasks: { [scope: string]: TaskDef<any>[] } = {};

  // Group the tasks into scopes...
  for (let rec of taskRecords) {
    if (!rec.scope) {
      rec.scope = '__no_scope';
    }
    if (!scopedTasks[rec.scope]) {
      scopedTasks[rec.scope] = [];
    }

    scopedTasks[rec.scope].push(rec);
  }

  // Save the scoped tasks in files named according to scope
  let keys = Object.keys(scopedTasks);
  for (let scope of keys) {
    let scopeFile = Path.join(scopedOutputsDir, `${scope}.json`);

    fileService.write({
      file: scopeFile,
      content: scopedTasks[scope]
    });
  }

  return task.fn(task);
}

/*
 * ++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
 * ++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
 * ++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
 * ++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
 */

const taskStore = {
  getAll(): TaskDef<any>[] {
    if (FS.existsSync(files.tasks)) {
      return require(files.tasks);
    }
    return [];
  },
  saveOne(taskDef: TaskDef<any>) {
    const records = this.getAll();
    records.push(taskDef);
    this.saveMany(records);
  },
  saveMany(taskDefs: TaskDef<any>[]) {
    const data = JSON.stringify(taskDefs, null, 2);
    FS.writeFileSync(files.tasks, data, { encoding: 'utf-8' });
  }
};

/*
 * ++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
 * ++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
 * ++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
 * ++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
 */
//region [fileService]
export namespace FileServiceParams {
  export type Write = {
    file: string;
    content: string | Array<any> | object;
  };

  export type Read = {
    file: string;
    expectJson?: boolean;
  };
}

const fileService = {
  write(params: FileServiceParams.Write) {
    let { file, content } = params;
    if (!file) return;

    if (typeof content !== 'string') {
      content = JSON.stringify(content, null, 2);
    }

    FS.writeFileSync(file, content, { encoding: 'utf-8' });
  },

  read(params: FileServiceParams.Read) {
    let { file, expectJson } = params;
    if (!file) return;

    const fileExists = FS.existsSync(file);

    if (fileExists) {
      if (expectJson) {
        return require(file);
      } else {
        return FS.readFileSync(file, { encoding: 'utf-8' });
      }
    } else {
      return null;
    }
  },

  resetDir(dirPath: string) {
    if (FS.existsSync(dirPath)) {
      FS.rmdirSync(dirPath, { recursive: true });
    }
    FS.mkdirSync(dirPath);
  },

  ensureDir(dirPath: string) {
    if (!FS.existsSync(dirPath)) {
      FS.mkdirSync(dirPath, { recursive: true });
    }
  }
};
//endregion
/*
 * ++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
 * ++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
 * ++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
 * ++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++++
 */

//region [ArchScope]
export abstract class ArchScope {
  private readonly name: string;
  protected title: string = '';
  protected description: string = '';

  protected constructor(scope: string) {
    this.name = scope;
  }

  /**
   * Register a task to be implemented.
   * @param taskDef
   */
  task<T>(taskDef: TaskDef<T>): T | unknown {
    return task({
      scope: this.name,
      ...taskDef
    });
  }

  getTitle() {
    return this.title;
  }

  getDescription() {
    return this.description;
  }
}

//endregion
