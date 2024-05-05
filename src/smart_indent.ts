import * as vscode from 'vscode';

// ============================================================================
// Parameters
// ============================================================================
const indentSpacingUnit = 2;
const debug = true;

export function test_smart_indent(line: string): string {
  return line;
}

// ============================================================================
// Getting indent level (not spacing) at the current line
// ============================================================================
export function getIndentLevel(line: string) {
  for (var i = 0; i < line.length; ++i) {
    if ([' ', '\t', '\n'].indexOf(line[i]) === -1) {
      break;
    }
  }
  let indentSpaces = i;
  let indentLevel = Math.ceil(indentSpaces / indentSpacingUnit);
  return indentLevel;
}

// ============================================================================
// Changing the heading indent and deleting trailing whitespaces
// ============================================================================
export function changeIndent(line: string, indentLevel: number) {
  return line.replace(/^\s*/, ' '.repeat(indentSpacingUnit * indentLevel));
}

// ============================================================================
// Removes line comment
// ============================================================================
export function removeLineComment(line: string) {
  return line.replace(/\/\/.*$/, '');
}

// ============================================================================
// Examine the line is valid or empty, true stands for valid
// ============================================================================
export function isValidLine(line: string) {
  let removedLine = line.replace(/\/\/.*$/, '');
  let deletedLine = line.replace(/\s+/, '');
  return deletedLine.length !== 0;
}

// ============================================================================
// Analyzing single indent keywords in a line
// ============================================================================
export function analyzeSingleIndentKeys(line: string) {
  line = removeLineComment(line);

  let findIndentKey =
    /\b(always|always_ff|always_comb|always_latch|if|else|for|while|do)\b/;
  let findBegin = /\bbegin\b/;
  let findSentence = /;/;

  if (findIndentKey.test(line)) {
    if (findBegin.test(line)) {
      return false;
    } else if (findSentence.test(line)) {
      return false;
    } else {
      return true;
    }
  } else {
    return false;
  }
}

// ============================================================================
// Analyzing block indent keywords in a line
// ============================================================================
export function analyzeBlockIndentKeys(line: string) {
  line = removeLineComment(line);

  let findIndentEntry = /\b(begin|function|task|module|package|case)\b/;
  let findIndentExit =
    /\b(end|endfunction|endtask|endmodule|endpackage|endcase)\b/;
  let findListEntry = /(\(|{|\[)/g;
  let findListExit = /(\)|}|\])/g;

  let cntIndentEntry = findIndentEntry.test(line) ? 1 : 0;
  let cntIndentExit = findIndentExit.test(line) ? 1 : 0;

  let mat;

  let cntListEntry = 0;
  while ((mat = findListEntry.exec(line)) !== null) {
    ++cntListEntry;
  }

  let cntListExit = 0;
  while ((mat = findListExit.exec(line)) !== null) {
    ++cntListExit;
  }

  return [cntIndentEntry - cntIndentExit, cntListEntry - cntListExit];
}

// ============================================================================
// Indent pair closing [0] aligns opening [1]
// ============================================================================
export function getIndentPair(line: string) {
  if (/\bend\b/.test(line)) {
    return ['end', 'begin'];
  }
  if (/\belse\b/.test(line)) {
    return ['else', 'if'];
  }
  if (/\bendcase\b/.test(line)) {
    return ['endcase', 'case'];
  }
  if (/\bendfunction\b/.test(line)) {
    return ['endfunction', 'function'];
  }
  if (/\bendtask\b/.test(line)) {
    return ['endtask', 'task'];
  }
  if (/\bendmodule\b/.test(line)) {
    return ['endmodule', 'module'];
  }
  if (/\bendpackage\b/.test(line)) {
    return ['endpackage', 'package'];
  }

  return null;
}

// ============================================================================
// Count key in a line
// ============================================================================
export function countKey(line: string, key: string) {
  let re = new RegExp('\\b' + key + '\\b', 'g');
  let cnt = 0;
  let mat;

  while ((mat = re.exec(line)) !== null) {
    ++cnt;
  }

  return cnt;
}

// ============================================================================
// Count opening and closing punctuation in a line
// ============================================================================
export function countPunc(line: string, opkey, clkey: string) {
  let reop = new RegExp(opkey);
  let recl = new RegExp(clkey);
  let opcnt = 0;
  let clcnt = 0;
  let mat;

  while ((mat = reop.exec(line)) !== null) {
    ++opcnt;
  }

  while ((mat = recl.exec(line)) !== null) {
    ++clcnt;
  }

  return [opcnt, clcnt];
}

// ============================================================================
// Find the line number where the corresponding pair exists
// ============================================================================
export function findIndentPair(
  doc: vscode.TextDocument,
  startLnum: number,
  pair: string[],
) {
  let i;
  let isElse = pair[0] === 'else';
  let cntPair = 0;
  let cntIndent = 0;
  let cntList = 0;

  for (i = startLnum - 1; i >= 0; --i) {
    let line = doc.lineAt(i).text;

    // Special for if-else
    if (isElse) {
      let [ind, lst] = analyzeBlockIndentKeys(line);

      cntIndent += ind;
      cntList += lst;

      if (cntIndent < 0 || cntList < 0) {
        // In foregn indent region
        continue;
      }
    }

    cntPair -= countKey(line, pair[0]);
    cntPair += countKey(line, pair[1]);

    if (cntPair > 0) {
      break;
    }
  }

  return i;
}

// ============================================================================
// Analyzing appropriate indent level
// ============================================================================
export function analyzeIndentLevelBackward(
  doc: vscode.TextDocument,
  curLnum: number,
) {
  let i;
  let cntIndent = 0;
  let cntList = 0;
  let anchorLnum = 0;
  let single = false;
  let sentenceExsit = false;
  let curLine = removeLineComment(doc.lineAt(curLnum).text);
  let indentPair = getIndentPair(curLine);

  // Find indent anchor line
  if (indentPair !== null) {
    anchorLnum = findIndentPair(doc, curLnum, indentPair);
    single = false;
  } else {
    // General sentence finds an opening indent
    for (i = curLnum - 1; i >= 0; --i) {
      let line = removeLineComment(doc.lineAt(i).text);
      let [ind, lst] = analyzeBlockIndentKeys(line);

      cntIndent += ind;
      cntList += lst;

      if (cntIndent < 0 || cntList < 0) {
        // In foregn indent region
        continue;
      }

      // General sentence finds an indent boundary
      if (analyzeSingleIndentKeys(line)) {
        if (!sentenceExsit) {
          anchorLnum = i;
          single = true;
          break;
        }
      }

      if (cntIndent >= 1 || cntList >= 1) {
        anchorLnum = i;
        single = false;
        break;
      }

      if (isValidLine(line)) {
        sentenceExsit = true;
      }
    }
  }

  // No anchor found (maybe out of all scopes or illegal grammer, level is 0)
  if (i < 0) {
    return 0;
  }

  // Get anchor indent level
  let anchorLine = doc.lineAt(anchorLnum).text;
  let anchorIndent = getIndentLevel(anchorLine);
  let indentLevel;

  if (indentPair === null) {
    if (/^\s*begin\b/.test(curLine)) {
      if (single) {
        // Line started with begin keeps anchor level
        // in single indent position
        indentLevel = anchorIndent;
      } else {
        // in block indent position
        indentLevel = anchorIndent + 1;
      }
    } else if (/^\s*[\}\)\]]/.test(curLine)) {
      // if line is started with closing parens, keeps anchor level
      indentLevel = anchorIndent;
    } else {
      // General sentence inc. anchor level
      indentLevel = anchorIndent + 1;
    }
  } else {
    // Specific sentence keep anchor level
    indentLevel = anchorIndent;
  }

  return indentLevel;
}

// ============================================================================
// Sentence format for decl. alignment
// ============================================================================
class SentenceFormat {
  type: string;
  broken: boolean;
  indent: number;
  posMod: number;
  posSig: number;
  posVec: number;
  posRst: number;
  posAss: number;
  modifier: string;
  signal: string;
  vector: string;
  rest: string;

  constructor() {
    this.type = 'general';
    this.broken = false;
    this.indent = -1;
    this.posMod = -1;
    this.posSig = -1;
    this.posVec = -1;
    this.posRst = -1;
    this.posAss = -1;
    this.modifier = '';
    this.signal = '';
    this.vector = '';
    this.rest = '';
  }
}

// ============================================================================
// Identify sentence format
// ============================================================================
export function getSentenceFormat(line: string) {
  let fmt = new SentenceFormat();

  let rePort = /^\b(input|output|inout)\b/;
  let reParam = /^\b(parameter|localparam)\b/;
  let reTypedef = /^\b(typedef)\b/;
  let reSignal =
    /^\b(wire|reg|logic|bit|int|integer|real|shortreal|string|event|\w+_t)\b(\s+(signed|unsigned))?/;
  // let reVector = /^(\[[^\]]+\]\s*?)+/;
  let reVector = /^((?:\[[^\]]+\]\s*)*(?:\[[^\]]+\]\s*?))/;

  let tmpLine = removeLineComment(line);
  let pos = 0;
  let mat: RegExpExecArray;

  fmt.broken = !/;/.test(line);

  if ((mat = /^\s+/.exec(tmpLine))) {
    fmt.indent = mat[0].length;
    tmpLine = tmpLine.slice(mat[0].length, tmpLine.length);
    pos += mat[0].length;
  }

  if ((mat = rePort.exec(tmpLine))) {
    fmt.type = 'port';
    fmt.posMod = pos;
    fmt.modifier = mat[0];

    tmpLine = tmpLine.slice(mat[0].length, tmpLine.length);
    pos += mat[0].length;

    if ((mat = /^\s+/.exec(tmpLine))) {
      tmpLine = tmpLine.slice(mat[0].length, tmpLine.length);
      pos += mat[0].length;
    }
  }

  if ((mat = reParam.exec(tmpLine))) {
    fmt.type = 'param';
    fmt.posMod = pos;
    fmt.modifier = mat[0];

    tmpLine = tmpLine.slice(mat[0].length, tmpLine.length);
    pos += mat[0].length;

    if ((mat = /^\s+/.exec(tmpLine))) {
      tmpLine = tmpLine.slice(mat[0].length, tmpLine.length);
      pos += mat[0].length;
    }
  }

  if ((mat = reTypedef.exec(tmpLine))) {
    fmt.type = 'typedef';
    fmt.posMod = pos;
    fmt.modifier = mat[0];

    tmpLine = tmpLine.slice(mat[0].length, tmpLine.length);
    pos += mat[0].length;

    if ((mat = /^\s+/.exec(tmpLine))) {
      tmpLine = tmpLine.slice(mat[0].length, tmpLine.length);
      pos += mat[0].length;
    }
  }

  if ((mat = reSignal.exec(tmpLine))) {
    if (fmt.type === 'general') {
      fmt.type = 'signal';
    }
    fmt.posSig = pos;
    fmt.signal = mat[0];

    tmpLine = tmpLine.slice(mat[0].length, tmpLine.length);
    pos += mat[0].length;

    if ((mat = /^\s+/.exec(tmpLine))) {
      tmpLine = tmpLine.slice(mat[0].length, tmpLine.length);
      pos += mat[0].length;
    }
  }

  if (fmt.type !== 'general') {
    // this line seems declaration
    if ((mat = reVector.exec(tmpLine))) {
      fmt.posVec = pos;
      fmt.vector = mat[0];

      tmpLine = tmpLine.slice(mat[0].length, tmpLine.length);
      pos += mat[0].length;

      if ((mat = /^\s+/.exec(tmpLine))) {
        tmpLine = tmpLine.slice(mat[0].length, tmpLine.length);
        pos += mat[0].length;
      }
    }

    fmt.posRst = pos;
    fmt.rest = tmpLine;
  } else {
    if (fmt.broken) {
      // general
    } else if ((mat = /\b(return|if|while|for)\b/.exec(tmpLine))) {
      // general
    } else if ((mat = /(<=|\+=|-=|~=|\s=)[^=].+;/.exec(tmpLine))) {
      fmt.type = 'assign';
      fmt.posAss = pos + mat.index;
    }
  }

  return fmt;
}

// ============================================================================
// Get the region where automatically aligned
// ============================================================================
export function getAlignBoundary(lnumStart: number, fmtCur: SentenceFormat) {
  let e = vscode.window.activeTextEditor;
  let d = e.document;
  let ss = e.selections;
  let s = ss[0];
  let c = s.active;

  let reIndentEntry = /\b(begin|function|task|module|package|case)\b/;
  let reIndentExit =
    /\b(end|endfunction|endtask|endmodule|endpackage|endcase)\b/;
  let reIndentSingle =
    /\b(always|always_ff|always_comb|always_latch|if|else|for|while|do)\b/;

  if (fmtCur.type === 'typedef' && fmtCur.broken) {
    return [c.line, c.line];
  }

  for (var startBound = lnumStart - 1; startBound >= 0; --startBound) {
    let line = d.lineAt(startBound).text;
    line = removeLineComment(line);

    if (!isValidLine(line)) {
      continue;
    }

    let fmtTmp = getSentenceFormat(line);

    if (fmtCur.type === 'typedef' && fmtTmp.broken) {
      break;
    }
    if (reIndentEntry.test(line)) {
      break;
    }
    if (reIndentExit.test(line)) {
      break;
    }
    if (reIndentSingle.test(line)) {
      break;
    }
    if (fmtCur.type !== fmtTmp.type) {
      break;
    }
  }

  for (var endBound = lnumStart + 1; endBound < d.lineCount; ++endBound) {
    let line = d.lineAt(endBound).text;
    line = removeLineComment(line);

    if (!isValidLine(line)) {
      continue;
    }

    let fmtTmp = getSentenceFormat(line);

    if (fmtCur.type === 'typedef' && fmtTmp.broken) {
      break;
    }
    if (fmtCur.type !== fmtTmp.type) {
      break;
    }
    if (reIndentEntry.test(line)) {
      break;
    }
    if (reIndentExit.test(line)) {
      break;
    }
    if (reIndentSingle.test(line)) {
      break;
    }
  }

  return [startBound + 1, endBound - 1];
}

// ============================================================================
// Insert string
// ============================================================================
export function insertString(line: string, pos: number, str: string) {
  if (pos <= 0) {
    return str + line;
  } else if (pos >= line.length) {
    return line + str;
  } else {
    return line.slice(0, pos) + str + line.slice(pos, line.length);
  }
}

// ============================================================================
// format keyword delimiters
// ============================================================================
export function formatDeclDelimiters(line: string) {
  let rePrt = /\b(input|output|inout)\b/.source;
  let rePrm = /\b(parameter|localparam)\b/.source;
  let reTyp = /\b(typedef)\b/.source;
  let reSigMod = /(signed|unsigned)/.source;
  let reSig = /\b(wire|reg|logic|bit|int|integer|real|shortreal|\w+_t)\b/
    .source;
  let reVec = /((?:\[[^\]]+\]\s*)*(?:\[[^\]]+\]\s*?))/.source;
  let re;

  re = new RegExp(`${rePrt}\\s*`);
  line = line.replace(re, '$1 ');

  re = new RegExp(`${rePrm}\\s*`);
  line = line.replace(re, '$1 ');

  re = new RegExp(`${reTyp}\\s+`);
  line = line.replace(re, '$1 ');

  re = new RegExp(`${reSig}\\s*(?!;)`);
  line = line.replace(re, '$1 ');

  re = new RegExp(`${reSigMod}\\s*`);
  line = line.replace(re, '$1 ');

  re = new RegExp(`${reVec}\\s*([^;])`);
  line = line.replace(re, '$1 $2');

  return line;
}

// ============================================================================
// Align signal type
// ============================================================================
export function alignSignalType(text: string[]) {
  let e = vscode.window.activeTextEditor;
  let d = e.document;
  let ss = e.selections;
  let s = ss[0];

  let pos = [];

  // Scanning align position
  for (let line of text) {
    let fmt = getSentenceFormat(line);
    pos.push(fmt.posSig);
  }

  let posMax = Math.max.apply(null, pos);

  for (let i = 0; i < text.length; ++i) {
    if (pos[i] >= 0) {
      let diff = posMax - pos[i];
      if (diff > 0) {
        text[i] = insertString(text[i], pos[i], ' '.repeat(diff));
      }
    }
  }

  return text;
}

// ============================================================================
// Align vector
// ============================================================================
export function alignVector(text: string[]) {
  let e = vscode.window.activeTextEditor;
  let d = e.document;
  let ss = e.selections;
  let s = ss[0];

  let pos = [];

  // Scanning align position
  for (let line of text) {
    let fmt = getSentenceFormat(line);
    pos.push(fmt.posVec);
  }

  let posMax = Math.max.apply(null, pos);

  for (let i = 0; i < text.length; ++i) {
    if (pos[i] >= 0) {
      let diff = posMax - pos[i];
      if (diff > 0) {
        text[i] = insertString(text[i], pos[i], ' '.repeat(diff));
      }
    }
  }

  return text;
}

// ============================================================================
// Align signal name
// ============================================================================
export function alignSignalName(text: string[]) {
  let e = vscode.window.activeTextEditor;
  let d = e.document;
  let ss = e.selections;
  let s = ss[0];

  let pos = [];

  // Scanning align position
  for (let line of text) {
    let fmt = getSentenceFormat(line);
    pos.push(fmt.posRst);
  }

  let posMax = Math.max.apply(null, pos);

  for (let i = 0; i < text.length; ++i) {
    if (pos[i] >= 0) {
      let diff = posMax - pos[i];
      if (diff > 0) {
        text[i] = insertString(text[i], pos[i], ' '.repeat(diff));
      }
    }
  }

  return text;
}

// ============================================================================
// Align assignment
// ============================================================================
export function alignAssign(text: string[]) {
  let e = vscode.window.activeTextEditor;
  let d = e.document;
  let ss = e.selections;
  let s = ss[0];

  let pos = [];

  // Scanning align position
  for (let line of text) {
    let fmt = getSentenceFormat(line);
    pos.push(fmt.posAss);
  }

  let posMax = Math.max.apply(null, pos);

  for (let i = 0; i < text.length; ++i) {
    if (pos[i] >= 0) {
      let diff = posMax - pos[i];
      if (diff > 0) {
        text[i] = insertString(text[i], pos[i], ' '.repeat(diff));
      }
    }
  }

  return text;
}

// ============================================================================
// Align assignment
// ============================================================================
export function alignBrokenAssign(text: string[]) {
  let e = vscode.window.activeTextEditor;
  let d = e.document;
  let ss = e.selections;
  let s = ss[0];

  let mat;

  for (let i = 0; i < text.length; ++i) {
    if ((mat = /^(\s*[^\(\)]+?\s*).=[^;]+$/.exec(removeLineComment(text[i])))) {
      if (/\bparameter\b.+,/.test(text[i])) {
        continue;
      }

      for (i = i + 1; i < text.length; ++i) {
        text[i] = text[i].replace(/^\s+/, ' '.repeat(mat[1].length + 3));
        if (/;/.test(removeLineComment(text[i]))) {
          break;
        }
      }
    }
  }

  return text;
}

// ============================================================================
// Aligning storage modifiers
// i.e., input/output/inout/parameter/typedef
// ============================================================================
async function alignIndentRegion(st, ed: number) {
  let e = vscode.window.activeTextEditor;
  let d = e.document;
  let ss = e.selections;
  let s = ss[0];
  let c = s.active;

  let rePrt = /\b(input|output|inout)\b/.source;
  let rePrm = /\b(parameter|localparam)\b/.source;
  let reTyp = /\b(typedef)\b/.source;
  let reSig = /\b(wire|reg|logic|bit|int|integer|real|shortreal|\w+_t)\b/
    .source;
  let reVec = /((?:\[[^\]]+\]\s*)*(?:\[[^\]]+\]\s*?))/.source;

  let text = [];

  // Indent
  for (let lnum = st; lnum <= ed; ++lnum) {
    let indentLevel = analyzeIndentLevelBackward(d, lnum);
    let line = changeIndent(d.lineAt(lnum).text, indentLevel);
    let fmt = getSentenceFormat(line);
    let type = fmt.type;

    if (
      type === 'port' ||
      type === 'param' ||
      type === 'typedef' ||
      type === 'signal'
    ) {
      line = formatDeclDelimiters(line);
    } else if (type === 'assign') {
      line = line.replace(/\s*(.=)\s*/, ' $1 ');
    }

    text.push(line);
  }

  text = alignSignalType(text);
  text = alignVector(text);
  text = alignSignalName(text);
  text = alignAssign(text);
  text = alignBrokenAssign(text);

  // Apply edit
  const succ = await e.edit(function (edit) {
    for (let i = 0; i < text.length; ++i) {
      let editStart = new vscode.Position(i + st, 0);
      let editEnd = new vscode.Position(i + st, d.lineAt(i + st).text.length);
      let rngEdit = new vscode.Range(editStart, editEnd);
      edit.replace(rngEdit, text[i]);
    }
  });

  if (!succ) {
    return false;
  }

  let targetIndent = getIndentLevel(d.lineAt(c).text);
  let posChar = c.character;
  if (posChar < targetIndent * indentSpacingUnit) {
    posChar = targetIndent * indentSpacingUnit;
  }
  // let newCursorPos = new vscode.Position(c.line, posChar);
  let newCursorPos = new vscode.Position(c.line, d.lineAt(c).text.length);
  e.selection = new vscode.Selection(newCursorPos, newCursorPos);

  return true;
}

// ============================================================================
// Aligning storage modifiers
// i.e., input/output/inout/parameter/typedef
// ============================================================================
async function alignIndentSmart(st: number) {
  let e = vscode.window.activeTextEditor;
  let d = e.document;
  let ss = e.selections;
  let s = ss[0];
  let c = s.active;

  let line = d.lineAt(st).text;
  let fmt = getSentenceFormat(line);

  let [bs, be] = getAlignBoundary(c.line, fmt);

  alignIndentRegion(bs, be);

  if (debug) {
    console.log(`Boundary (${bs + 1}, ${be + 1})`);
  }

  return true;
}

// ============================================================================
// Auto indentation
// ============================================================================
export function autoIndent(st, ed: number) {
  let e = vscode.window.activeTextEditor;
  let d = e.document;
  let ss = e.selections;
  let s = ss[0];
  let c = s.active;

  let text = [];

  // Indent
  for (let lnum = st; lnum <= ed; ++lnum) {
    let indentLevel = analyzeIndentLevelBackward(d, lnum);
    let line = changeIndent(d.lineAt(lnum).text, indentLevel);

    text.push(line);
  }

  // Apply edit
  e.edit(function (edit) {
    for (let i = 0; i < text.length; ++i) {
      let editStart = new vscode.Position(i + st, 0);
      let editEnd = new vscode.Position(i + st, d.lineAt(i + st).text.length);
      let rngEdit = new vscode.Range(editStart, editEnd);
      edit.replace(rngEdit, text[i]);
    }
  });

  let targetIndent = getIndentLevel(d.lineAt(c).text);
  let posChar = c.character;
  if (posChar < targetIndent * indentSpacingUnit) {
    posChar = targetIndent * indentSpacingUnit;
  }
  let newCursorPos = new vscode.Position(c.line, posChar);
  e.selection = new vscode.Selection(newCursorPos, newCursorPos);

  return true;
}

// ============================================================================
// Auto indentation with aligning
// ============================================================================
export function smartIndent() {
  if (!vscode.window.activeTextEditor) {
    vscode.window.showInformationMessage('Open files first!');
    return;
  }

  let e = vscode.window.activeTextEditor;
  let d = e.document;
  let ss = e.selections;
  let s = ss[0];
  let c = s.active;

  let st = s.start.line;
  let ed = s.end.line;

  if (st === ed) {
    alignIndentSmart(c.line);
  } else {
    autoIndent(st, ed);
  }
}

// ============================================================================
// Align with RegExp
// ============================================================================
export function alignRegExp(re: string) {
  if (!vscode.window.activeTextEditor) {
    vscode.window.showInformationMessage('Open files first!');
    return;
  }

  let e = vscode.window.activeTextEditor;
  let d = e.document;
  let ss = e.selections;
  let s = ss[0];
  let c = s.active;

  let st = s.start.line;
  let ed = s.end.line;

  let text = [];

  for (let lnum = st; lnum <= ed; ++lnum) {
    text.push(d.lineAt(lnum).text);
  }

  let pos = [];

  // Scanning align position
  for (let i = 0; i < text.length; ++i) {
    text[i] = text[i].replace(RegExp(`\\s*(${re})`), ' $1');
    pos.push(text[i].search(RegExp(`${re}`)));
  }

  let posMax = Math.max.apply(null, pos);

  for (let i = 0; i < text.length; ++i) {
    if (pos[i] >= 0) {
      let diff = posMax - pos[i];
      if (diff > 0) {
        text[i] = insertString(text[i], pos[i], ' '.repeat(diff));
      }
    }
  }

  // Apply edit
  e.edit(function (edit) {
    for (let i = 0; i < text.length; ++i) {
      let editStart = new vscode.Position(i + st, 0);
      let editEnd = new vscode.Position(i + st, d.lineAt(i + st).text.length);
      let rngEdit = new vscode.Range(editStart, editEnd);
      edit.replace(rngEdit, text[i]);
    }
  });

  return true;
}

export function alignOpenParen() {
  alignRegExp('\\(');
}
export function alignLineComment() {
  alignRegExp('\\/\\/');
}
export function alignEqual() {
  alignRegExp('=');
}

// ============================================================================
// Align equals in a seleted region
// ============================================================================
export function alignRegExpWithInput() {
  if (!vscode.window.activeTextEditor) {
    vscode.window.showInformationMessage('Open files first!');
    return;
  }

  vscode.window
    .showInputBox({
      prompt: 'Align with regexp',
      password: false,
      value: '',
    })
    .then((str) => {
      if (!str) {
        return;
      }

      alignRegExp(str);
    });
}

// ============================================================================
// Delete tail white spaces
// ============================================================================
export function deleteTrailingWhiteSpaces() {
  if (!vscode.window.activeTextEditor) {
    vscode.window.showInformationMessage('Open files first!');
    return;
  }

  let e = vscode.window.activeTextEditor;
  let d = e.document;
  let ss = e.selections;
  let s = ss[0];
  let c = s.active;

  let st = s.start.line;
  let ed = s.end.line;

  let text = [];

  for (let lnum = st; lnum <= ed; ++lnum) {
    let line = d.lineAt(lnum).text.replace(/\s+$/, '');
    text.push(line);
  }

  // Apply edit
  e.edit(function (edit) {
    for (let i = 0; i < text.length; ++i) {
      let editStart = new vscode.Position(i + st, 0);
      let editEnd = new vscode.Position(i + st, d.lineAt(i + st).text.length);
      let rngEdit = new vscode.Range(editStart, editEnd);
      edit.replace(rngEdit, text[i]);
    }
  });

  return true;
}

// ============================================================================
// Convert port decls to port connections
// ============================================================================
export function convPortDeclToConn(type: string) {
  if (!vscode.window.activeTextEditor) {
    vscode.window.showInformationMessage('Open files first!');
    return;
  }

  let e = vscode.window.activeTextEditor;
  let d = e.document;
  let ss = e.selections;
  let s = ss[0];
  let c = s.active;

  let st = s.start.line;
  let ed = s.end.line;

  let text = [];

  for (let lnum = st; lnum <= ed; ++lnum) {
    let re = /(?:input|output|inout).+\s+(\w+)(;|,)?\s*$/;
    let line;
    if (!type) {
      line = d.lineAt(lnum).text.replace(re, '.$1 ()$2');
    } else if (type === 'implicit') {
      line = d.lineAt(lnum).text.replace(re, '.$1$2');
    }
    text.push(line);
  }

  // Apply edit
  e.edit(function (edit) {
    for (let i = 0; i < text.length; ++i) {
      let editStart = new vscode.Position(i + st, 0);
      let editEnd = new vscode.Position(i + st, d.lineAt(i + st).text.length);
      let rngEdit = new vscode.Range(editStart, editEnd);
      edit.replace(rngEdit, text[i]);
    }
  });

  if (debug) {
    console.log(`${type}`);
  }

  return true;
}

export function convPortDeclToConnImplicit() {
  convPortDeclToConn('implicit');
}

// ============================================================================
// Convert port decls to signal decls
// ============================================================================
export function convPortDeclToSignal() {
  if (!vscode.window.activeTextEditor) {
    vscode.window.showInformationMessage('Open files first!');
    return;
  }

  let e = vscode.window.activeTextEditor;
  let d = e.document;
  let ss = e.selections;
  let s = ss[0];
  let c = s.active;

  let st = s.start.line;
  let ed = s.end.line;

  let text = [];

  for (let lnum = st; lnum <= ed; ++lnum) {
    let re = /(?:input|output|inout)(.+?)(;|,)?\s*$/;
    let line = d.lineAt(lnum).text.replace(re, '$1;');
    text.push(line);
  }

  // Apply edit
  e.edit(function (edit) {
    for (let i = 0; i < text.length; ++i) {
      let editStart = new vscode.Position(i + st, 0);
      let editEnd = new vscode.Position(i + st, d.lineAt(i + st).text.length);
      let rngEdit = new vscode.Range(editStart, editEnd);
      edit.replace(rngEdit, text[i]);
    }
  });

  return true;
}

// ============================================================================
// Convert port decls to next signal decls
// ============================================================================
export function convPortDeclToNextSignal() {
  if (!vscode.window.activeTextEditor) {
    vscode.window.showInformationMessage('Open files first!');
    return;
  }

  let e = vscode.window.activeTextEditor;
  let d = e.document;
  let ss = e.selections;
  let s = ss[0];
  let c = s.active;

  let st = s.start.line;
  let ed = s.end.line;

  let text = [];

  for (let lnum = st; lnum <= ed; ++lnum) {
    let re = /(?:input|output|inout)(.+?)(;|,)?\s*$/;
    let line = d.lineAt(lnum).text.replace(re, '$1_n;');
    text.push(line);
  }

  // Apply edit
  e.edit(function (edit) {
    for (let i = 0; i < text.length; ++i) {
      let editStart = new vscode.Position(i + st, 0);
      let editEnd = new vscode.Position(i + st, d.lineAt(i + st).text.length);
      let rngEdit = new vscode.Range(editStart, editEnd);
      edit.replace(rngEdit, text[i]);
    }
  });

  return true;
}

// ============================================================================
// Convert port decls to next signal decls
// ============================================================================
export function convPortDeclToReset() {
  if (!vscode.window.activeTextEditor) {
    vscode.window.showInformationMessage('Open files first!');
    return;
  }

  let e = vscode.window.activeTextEditor;
  let d = e.document;
  let ss = e.selections;
  let s = ss[0];
  let c = s.active;

  let st = s.start.line;
  let ed = s.end.line;

  let text = [];

  for (let lnum = st; lnum <= ed; ++lnum) {
    let re = /(?:output|inout)\s+(.+?)(;|,)?\s*$/;
    let line = d.lineAt(lnum).text.replace(re, "$1 <= '0;");
    text.push(line);
  }

  // Apply edit
  e.edit(function (edit) {
    for (let i = 0; i < text.length; ++i) {
      let editStart = new vscode.Position(i + st, 0);
      let editEnd = new vscode.Position(i + st, d.lineAt(i + st).text.length);
      let rngEdit = new vscode.Range(editStart, editEnd);
      edit.replace(rngEdit, text[i]);
    }
  });

  return true;
}

// ============================================================================
// Convert signal decls to reset descriptions
// ============================================================================
export function convSignalDeclToReset(type: string) {
  if (!vscode.window.activeTextEditor) {
    vscode.window.showInformationMessage('Open files first!');
    return;
  }

  let e = vscode.window.activeTextEditor;
  let d = e.document;
  let ss = e.selections;
  let s = ss[0];
  let c = s.active;

  let st = s.start.line;
  let ed = s.end.line;

  let text = [];

  for (let lnum = st; lnum <= ed; ++lnum) {
    let re = /((?:\w+\s*,\s*)*\w+\s*)(;|,)\s*$/;
    let line = removeLineComment(d.lineAt(lnum).text);
    let mat = re.exec(line);
    let newline;
    if (mat) {
      let idents = mat[1].split(',');
      if (!type) {
        newline = idents[0].trim() + " <= '0;";
        // line = removeLineComment(d.lineAt(lnum).text).replace(re, "$1 <= '0;");
      } else if (type === 'blocking') {
        newline = idents[0].trim() + " = '0;";
        // line = removeLineComment(d.lineAt(lnum).text).replace(re, "$1 = '0;");
      }
    } else {
      newline = line;
    }
    text.push(newline);
  }

  // Apply edit
  e.edit(function (edit) {
    for (let i = 0; i < text.length; ++i) {
      let editStart = new vscode.Position(i + st, 0);
      let editEnd = new vscode.Position(i + st, d.lineAt(i + st).text.length);
      let rngEdit = new vscode.Range(editStart, editEnd);
      edit.replace(rngEdit, text[i]);
    }
  });

  return true;
}

export function convSignalDeclToBReset() {
  convSignalDeclToReset('blocking');
}

// ============================================================================
// Convert reset descriptions to update descriptions for ff
// ============================================================================
export function convResetToUpdate() {
  if (!vscode.window.activeTextEditor) {
    vscode.window.showInformationMessage('Open files first!');
    return;
  }

  let e = vscode.window.activeTextEditor;
  let d = e.document;
  let ss = e.selections;
  let s = ss[0];
  let c = s.active;

  let st = s.start.line;
  let ed = s.end.line;

  let text = [];

  for (let lnum = st; lnum <= ed; ++lnum) {
    let re = /^.+\s(\w+?)\s*<=.+;/;
    let line = d.lineAt(lnum).text.replace(re, '$1 <= $1_n;');
    text.push(line);
  }

  // Apply edit
  e.edit(function (edit) {
    for (let i = 0; i < text.length; ++i) {
      let editStart = new vscode.Position(i + st, 0);
      let editEnd = new vscode.Position(i + st, d.lineAt(i + st).text.length);
      let rngEdit = new vscode.Range(editStart, editEnd);
      edit.replace(rngEdit, text[i]);
    }
  });

  return true;
}

// ============================================================================
// Convert reset descriptions to next descriptions for ff
// ============================================================================
export function convResetToNext() {
  if (!vscode.window.activeTextEditor) {
    vscode.window.showInformationMessage('Open files first!');
    return;
  }

  let e = vscode.window.activeTextEditor;
  let d = e.document;
  let ss = e.selections;
  let s = ss[0];
  let c = s.active;

  let st = s.start.line;
  let ed = s.end.line;

  let text = [];

  for (let lnum = st; lnum <= ed; ++lnum) {
    let re = /^.+\s(\w+?)\s*<=.+;/;
    let line = d.lineAt(lnum).text.replace(re, '$1_n = $1;');
    text.push(line);
  }

  // Apply edit
  e.edit(function (edit) {
    for (let i = 0; i < text.length; ++i) {
      let editStart = new vscode.Position(i + st, 0);
      let editEnd = new vscode.Position(i + st, d.lineAt(i + st).text.length);
      let rngEdit = new vscode.Range(editStart, editEnd);
      edit.replace(rngEdit, text[i]);
    }
  });

  return true;
}

// ============================================================================
// Increment multi selected numbers
// ============================================================================
export function incSelectedNumbers() {
  if (!vscode.window.activeTextEditor) {
    vscode.window.showInformationMessage('Open files first!');
    return;
  }

  let e = vscode.window.activeTextEditor;
  let d = e.document;
  let ss = e.selections;

  let precs = [];
  let nums = [];
  let succs = [];

  for (let i = 0; i < ss.length; ++i) {
    let s = ss[i];
    let text = d.getText(s);
    let mat = /^([^\d]*)(\d+)(.*)$/.exec(text);
    if (mat) {
      precs.push(mat[1]);
      nums.push((Number(mat[2]) + 1).toString());
      succs.push(mat[3]);
    } else {
      precs.push('');
      nums.push('');
      succs.push('');
    }
  }

  // Apply edit
  e.edit(function (edit) {
    for (let i = 0; i < ss.length; ++i) {
      if (nums[i].length > 0) {
        edit.replace(ss[i], `${precs[i]}${nums[i]}${succs[i]}`);
      }
    }
  });

  return true;
}

// ============================================================================
// Insert sequential numbers to the selected regions
// ============================================================================
export function insSeqNumber() {
  if (!vscode.window.activeTextEditor) {
    vscode.window.showInformationMessage('Open files first!');
    return;
  }

  vscode.window
    .showInputBox({
      prompt: 'Start nubmer?',
      password: false,
      value: '',
    })
    .then((str) => {
      if (!str) {
        return;
      }

      let start = Number(str);

      let e = vscode.window.activeTextEditor;
      let d = e.document;
      let ss = e.selections;

      let precs = [];
      let nums = [];
      let succs = [];

      for (let i = 0; i < ss.length; ++i) {
        let s = ss[i];
        let text = d.getText(s);
        let mat = /^([^\d]*)(\d+)(.*)$/.exec(text);
        if (mat) {
          precs.push(mat[1]);
          nums.push((start + i).toString());
          succs.push(mat[3]);
        } else if (text.length === 0) {
          precs.push('');
          nums.push((start + i).toString());
          succs.push('');
        } else {
          precs.push('');
          nums.push('');
          succs.push('');
        }
      }

      // Apply edit
      e.edit(function (edit) {
        for (let i = 0; i < ss.length; ++i) {
          if (nums[i].length > 0) {
            edit.replace(ss[i], `${precs[i]}${nums[i]}${succs[i]}`);
          }
        }
      });
    });

  return true;
}

// ============================================================================
// Swap port direction
// ============================================================================
export function swapPortDirection() {
  if (!vscode.window.activeTextEditor) {
    vscode.window.showInformationMessage('Open files first!');
    return;
  }

  let e = vscode.window.activeTextEditor;
  let d = e.document;
  let ss = e.selections;
  let s = ss[0];
  let c = s.active;

  let st = s.start.line;
  let ed = s.end.line;

  let text = [];

  for (let lnum = st; lnum <= ed; ++lnum) {
    let line = d.lineAt(lnum).text;
    if (/\binput\b/.test(line)) {
      line = line.replace(/\binput\b/, 'output');
    } else {
      line = line.replace(/\boutput\b/, 'input');
    }
    text.push(line);
  }

  // Apply edit
  e.edit(function (edit) {
    for (let i = 0; i < text.length; ++i) {
      let editStart = new vscode.Position(i + st, 0);
      let editEnd = new vscode.Position(i + st, d.lineAt(i + st).text.length);
      let rngEdit = new vscode.Range(editStart, editEnd);
      edit.replace(rngEdit, text[i]);
    }
  });

  return true;
}

// ============================================================================
// Swap port direction
// ============================================================================
export function labelComment() {
  if (!vscode.window.activeTextEditor) {
    vscode.window.showInformationMessage('Open files first!');
    return;
  }

  let e = vscode.window.activeTextEditor;
  let d = e.document;
  let ss = e.selections;
  let s = ss[0];
  let c = s.active;

  let st = s.start.line;
  let ed = s.end.line;

  let line = d.lineAt(st).text.replace(/\s*$/, '');
  let mat = /(\S+)\s*:/.exec(line);

  if (mat) {
    let label = mat[1];
    let lenLine = line.length;
    let lenLabel = label.length;

    let newline =
      line +
      ' // ' +
      '-'.repeat(80 - lenLine - 4 - (lenLabel + 3)) +
      ` [${label}]`;

    // Apply edit
    e.edit(function (edit) {
      let editStart = new vscode.Position(st, 0);
      let editEnd = new vscode.Position(st, d.lineAt(st).text.length);
      let rngEdit = new vscode.Range(editStart, editEnd);
      edit.replace(rngEdit, newline);
    });
  }

  return true;
}
