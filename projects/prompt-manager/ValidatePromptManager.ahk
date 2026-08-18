; ============================================================
;  ValidatePromptManager.ahk — project health checker
;  Run standalone: right-click → Run Script, or double-click
;  Exit code 0 = clean, 1 = warnings only, 2 = errors found
; ============================================================
#NoEnv
#SingleInstance Force
SetBatchLines -1
SetWorkingDir %A_ScriptDir%

AppFile     := A_ScriptDir . "\PromptManager.ahk"
DataFile    := A_ScriptDir . "\prompts.ini"
HistoryFile := A_ScriptDir . "\prompts_history.ini"
ShimFile    := A_ScriptDir . "\ValidatePrompts.ahk"
ConsoleMode := false
for i, arg in A_Args
{
    if (arg = "/cli" || arg = "--cli" || arg = "/quiet" || arg = "--quiet")
        ConsoleMode := true
}

Snippets  := {}   ; id → {name, category, group, tags, content, fav, uses, uid, created, updated}
NameIndex := {}   ; lowercase name → id  (duplicate detection)
Errors    := []
Warnings  := []
Info       := []

; ── Project/config checks ───────────────────────────────────
GoSub ValidateProjectConfig

; ── Load ────────────────────────────────────────────────────
IfNotExist, %DataFile%
{
    if (ConsoleMode)
        FileAppend, prompts.ini not found:`n%DataFile%`n, *
    else
        MsgBox 16, ValidatePromptManager, prompts.ini not found:`n%DataFile%
    ExitApp 2
}

IniRead, sections, %DataFile%
snippetCount := 0

Loop Parse, sections, `n, `r
{
    sec := A_LoopField
    if (sec = "")
        continue
    if !RegExMatch(sec, "^snippet_\d+$")
        continue

    RegExMatch(sec, "\d+", numStr)
    id := numStr + 0

    IniRead, nm,  %DataFile%, %sec%, name,     ???
    IniRead, cat, %DataFile%, %sec%, category, ???
    IniRead, grp, %DataFile%, %sec%, group,
    IniRead, tgs, %DataFile%, %sec%, tags,
    IniRead, raw, %DataFile%, %sec%, content,  ???
    IniRead, fv,  %DataFile%, %sec%, fav,      ???
    IniRead, us,  %DataFile%, %sec%, uses,     ???
    IniRead, uid, %DataFile%, %sec%, uid,
    IniRead, des, %DataFile%, %sec%, description,
    IniRead, mdl, %DataFile%, %sec%, model,
    IniRead, src, %DataFile%, %sec%, source,
    IniRead, crt, %DataFile%, %sec%, created,
    IniRead, upd, %DataFile%, %sec%, updated,

    if (grp = "ERROR")
        grp := ""
    if (tgs = "ERROR")
        tgs := ""
    if (uid = "ERROR")
        uid := ""
    if (des = "ERROR")
        des := ""
    if (mdl = "ERROR")
        mdl := ""
    if (src = "ERROR")
        src := ""
    if (crt = "ERROR")
        crt := ""
    if (upd = "ERROR")
        upd := ""

    decoded := raw
    StringReplace, decoded, decoded, ``n, `n, All
    StringReplace, decoded, decoded, ``t, %A_Tab%, All

    Snippets[id] := {name: nm, category: cat, group: grp, tags: tgs
        , content: decoded, raw: raw, fav: fv, uses: us, sec: sec
        , uid: uid, description: des, model: mdl, source: src
        , created: crt, updated: upd}
    snippetCount++
}

if (snippetCount = 0)
{
    Errors.Push("No snippet sections found in prompts.ini")
    GoSub ShowReport
    ExitApp 2
}

GoSub ValidatePromptLibrary

GoSub ValidateHistoryLog

GoSub ShowReport
return

; ── Project/config checks ───────────────────────────────────
ValidateProjectConfig:
    if !FileExist(AppFile)
        Errors.Push("PromptManager.ahk is missing")
    else {
        Info.Push("App script found: PromptManager.ahk")
        appEncoding := GetFileEncoding(AppFile)
        if (appEncoding = "UTF-16LE" || appEncoding = "UTF-16BE")
            Warnings.Push("PromptManager.ahk is " appEncoding "; AHK source is easier to diff and review as UTF-8/ANSI")

        FileRead, appText, %AppFile%
        if (ErrorLevel)
            Errors.Push("PromptManager.ahk could not be read")
        else {
            if !InStr(appText, "DataFile := A_ScriptDir . ""\prompts.ini""")
                Errors.Push("PromptManager.ahk does not use A_ScriptDir for prompts.ini")
            if !InStr(appText, "HistoryFile := A_ScriptDir . ""\prompts_history.ini""")
                Warnings.Push("PromptManager.ahk does not declare prompts_history.ini with A_ScriptDir")
            if !InStr(appText, "OnExportMarkdown:")
                Warnings.Push("Markdown export handler OnExportMarkdown is missing")
            if !InStr(appText, "GenerateSnippetUid()")
                Warnings.Push("Stable UID helper GenerateSnippetUid() is missing")
        }
    }

    if !FileExist(DataFile)
        Errors.Push("prompts.ini is missing")
    else {
        dataEncoding := GetFileEncoding(DataFile)
        Info.Push("Prompt data found: prompts.ini (" dataEncoding ")")
        FileGetSize, dataSize, %DataFile%
        if (dataSize = 0)
            Errors.Push("prompts.ini is empty")
        if (dataEncoding = "UTF-8-BOM" || dataEncoding = "UTF-8/ANSI")
            Warnings.Push("prompts.ini is " dataEncoding "; Prompt Manager saves INI files through AHK IniWrite, so UTF-16LE is the safest local format")
    }

    if FileExist(HistoryFile) {
        histEncoding := GetFileEncoding(HistoryFile)
        Info.Push("History log found: prompts_history.ini (" histEncoding ")")
    } else
        Info.Push("History log not present yet; it will be created after the first edit/delete")

    if FileExist(ShimFile)
        Info.Push("Compatibility launcher found: ValidatePrompts.ahk")
    else
        Warnings.Push("ValidatePrompts.ahk compatibility launcher is missing")
return

; ── Prompt library checks ───────────────────────────────────
ValidatePromptLibrary:
; 1. Name: empty or load-error sentinel
for id, s in Snippets
{
    if (s.name = "" || s.name = "???")
        Errors.Push("[" s.sec "] name is missing or unreadable")
}

; 2. Content: load-error sentinel or empty after decoding
for id, s in Snippets
{
    if (s.raw = "???")
        Errors.Push("[" s.sec "] """ s.name """ — content failed to load (IniRead returned ???)")
    else if (s.content = "")
        Warnings.Push("[" s.sec "] """ s.name """ — content is empty")
}

; 3. fav must be 0 or 1
for id, s in Snippets
{
    if (s.fav = "???")
        Errors.Push("[" s.sec "] """ s.name """ — fav field missing")
    else if (s.fav != 0 && s.fav != 1)
        Errors.Push("[" s.sec "] """ s.name """ — fav=" s.fav " (expected 0 or 1)")
}

; 4. uses must be a non-negative integer
for id, s in Snippets
{
    if (s.uses = "???")
        Errors.Push("[" s.sec "] """ s.name """ — uses field missing")
    else if !RegExMatch(s.uses, "^\d+$")
        Errors.Push("[" s.sec "] """ s.name """ — uses=" s.uses " (expected non-negative integer)")
}

; 5. Duplicate names (case-insensitive)
for id, s in Snippets
{
    if (s.name = "" || s.name = "???")
        continue
    nameLow := s.name
    StringLower, nameLow, nameLow
    if (NameIndex.HasKey(nameLow))
        Errors.Push("[" s.sec "] """ s.name """ — duplicate of [snippet_" NameIndex[nameLow] "]")
    else
        NameIndex[nameLow] := id
}

; 6. Broken @{include} references
for id, s in Snippets
{
    if (s.content = "" || s.raw = "???")
        continue
    pos := 1
    while (pos := RegExMatch(s.content, "@\{([^{}]+)\}", m, pos))
    {
        refName := m1
        found := false
        for sid, so in Snippets
        {
            if (so.name = refName)
            {
                found := true
                break
            }
        }
        if (!found)
            Warnings.Push("[" s.sec "] """ s.name """ — @{" refName "} references a snippet that does not exist")
        pos += StrLen(m)
    }
}

; 7. Circular @{include} chains (DFS)
;    Build adjacency list first (name → list of included names)
IncludeMap := {}
for id, s in Snippets
{
    deps := []
    pos := 1
    while (pos := RegExMatch(s.content, "@\{([^{}]+)\}", m, pos))
    {
        deps.Push(m1)
        pos += StrLen(m)
    }
    IncludeMap[s.name] := deps
}

for id, s in Snippets
{
    startName := s.name
    visited   := {}
    stack     := [startName]
    visited[startName] := true
    cycle := false
    Loop 200
    {
        if (stack.Length() = 0 || cycle)
            break
        cur := stack[stack.Length()]
        stack.Pop()
        if (!IncludeMap.HasKey(cur))
            continue
        for i, dep in IncludeMap[cur]
        {
            if (dep = startName)
            {
                cycle := true
                Errors.Push("[" s.sec "] """ startName """ — circular @{include} chain detected (via """ cur """ → """ dep """)")
                break
            }
            if (!visited.HasKey(dep))
            {
                visited[dep] := true
                stack.Push(dep)
            }
        }
    }
}

; 8. Whitespace-only name
for id, s in Snippets
{
    if (s.name = "" || s.name = "???")
        continue
    trimmed := s.name
    StringReplace, trimmed, trimmed, %A_Space%, , All
    StringReplace, trimmed, trimmed, %A_Tab%,   , All
    if (trimmed = "")
        Errors.Push("[" s.sec "] name is whitespace-only")
}

; 9. Whitespace-only content
for id, s in Snippets
{
    if (s.content = "" || s.raw = "???")
        continue
    trimmed := s.content
    StringReplace, trimmed, trimmed, `n,       , All
    StringReplace, trimmed, trimmed, `r,       , All
    StringReplace, trimmed, trimmed, %A_Tab%,  , All
    StringReplace, trimmed, trimmed, %A_Space%, , All
    if (trimmed = "")
        Warnings.Push("[" s.sec "] """ s.name """ — content is whitespace-only")
}

; 10. Name contains INI-special characters (corrupt on next save)
for id, s in Snippets
{
    if (s.name = "" || s.name = "???")
        continue
    if (InStr(s.name, "=") || InStr(s.name, "[") || InStr(s.name, "]"))
        Warnings.Push("[" s.sec "] """ s.name """ — name contains INI-special char (= [ ]) which may corrupt the file on save")
}

; 11. Name longer than 80 chars (truncated in ListView)
for id, s in Snippets
{
    if (s.name = "" || s.name = "???")
        continue
    nameLen := StrLen(s.name)
    if (nameLen > 80)
        Warnings.Push("[" s.sec "] """ s.name """ — name is " nameLen " chars (> 80; will be clipped in the list view)")
}

; 12. Placeholder count exceeds the app's hard limit of 15
for id, s in Snippets
{
    if (s.content = "" || s.raw = "???")
        continue
    phCount := 0
    phSeen := {}
    pos := 1
    while (pos := RegExMatch(s.content, "\{([^{}`n]+)\}", m, pos))
    {
        phName := m1
        if (phName = "clipboard" || phName = "date" || phName = "datetime")
        {
            pos += StrLen(m)
            continue
        }
        if (!phSeen.HasKey(phName))
        {
            phSeen[phName] := true
            phCount++
        }
        pos += StrLen(m)
    }
    if (phCount > 15)
        Errors.Push("[" s.sec "] """ s.name """ — " phCount " unique placeholders (app limit is 15; extras are silently ignored)")
}

; 13. @{include} chain depth exceeds the app's 20-iteration limit
for id, s in Snippets
{
    if (!IncludeMap.HasKey(s.name) || IncludeMap[s.name].Length() = 0)
        continue
    queue    := [{name: s.name, depth: 0}]
    bfsVisit := {}
    bfsVisit[s.name] := true
    maxDepth := 0
    Loop 500
    {
        if (queue.Length() = 0)
            break
        cur := queue[1]
        queue.RemoveAt(1)
        if (cur.depth > maxDepth)
            maxDepth := cur.depth
        if (!IncludeMap.HasKey(cur.name))
            continue
        for i, dep in IncludeMap[cur.name]
        {
            if (!bfsVisit.HasKey(dep))
            {
                bfsVisit[dep] := true
                queue.Push({name: dep, depth: cur.depth + 1})
            }
        }
    }
    if (maxDepth >= 20)
        Warnings.Push("[" s.sec "] """ s.name """ — @{include} chain reaches depth " maxDepth " (app limit is 20; deeper expansions are silently truncated)")
}

; 14. Identical content across two snippets (likely accidental duplicate)
ContentIndex := {}
for id, s in Snippets
{
    if (s.content = "" || s.raw = "???")
        continue
    if (ContentIndex.HasKey(s.content))
    {
        otherId   := ContentIndex[s.content]
        otherName := Snippets[otherId].name
        Warnings.Push("[" s.sec "] """ s.name """ — content is identical to [snippet_" otherId "] """ otherName """")
    }
    else
        ContentIndex[s.content] := id
}

; 15. Double-escaped sequences still present in decoded content
;     Backtick+n or backtick+t remaining after decode → double-encoded during save
for id, s in Snippets
{
    if (s.content = "" || s.raw = "???")
        continue
    if (RegExMatch(s.content, "``[nt]"))
        Warnings.Push("[" s.sec "] """ s.name """ — decoded content still contains ``n/``t sequences (possible double-encoding during save)")
}

; 16. Section ID gaps (normal after deletions, but worth noting)
{
    minId := 999999, maxId := 0
    for id, s in Snippets
    {
        if (id < minId)
            minId := id
        if (id > maxId)
            maxId := id
    }
    missingList := ""
    gapCount := 0
    Loop % (maxId - minId + 1)
    {
        checkId := minId + A_Index - 1
        if (!Snippets.HasKey(checkId))
        {
            missingList .= (missingList ? ", " : "") . checkId
            gapCount++
        }
    }
    if (gapCount > 0)
        Warnings.Push("Section ID gaps: missing snippet_" missingList " (normal after deletions, but " gapCount " slot(s) wasted in the file)")
}

; 17. Stable sync metadata
UidIndex := {}
for id, s in Snippets
{
    if (s.uid = "")
        Warnings.Push("[" s.sec "] """ s.name """ — uid is missing (save once in Prompt Manager to generate stable sync metadata)")
    else if !RegExMatch(s.uid, "^[A-Za-z0-9._:-]+$")
        Errors.Push("[" s.sec "] """ s.name """ — uid contains unsafe characters for sync/export")
    else if (UidIndex.HasKey(s.uid))
        Errors.Push("[" s.sec "] """ s.name """ — duplicate uid also used by [snippet_" UidIndex[s.uid] "]")
    else
        UidIndex[s.uid] := id

    if (s.created = "")
        Warnings.Push("[" s.sec "] """ s.name """ — created timestamp is missing")
    else if !RegExMatch(s.created, "^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$")
        Warnings.Push("[" s.sec "] """ s.name """ — created timestamp should be yyyy-MM-dd HH:mm:ss")

    if (s.updated = "")
        Warnings.Push("[" s.sec "] """ s.name """ — updated timestamp is missing")
    else if !RegExMatch(s.updated, "^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$")
        Warnings.Push("[" s.sec "] """ s.name """ — updated timestamp should be yyyy-MM-dd HH:mm:ss")

    if (StrLen(s.description) > 240)
        Warnings.Push("[" s.sec "] """ s.name """ — description is " StrLen(s.description) " chars (> 240; keep library metadata scannable)")
}

return

; ── History/config state checks ─────────────────────────────
ValidateHistoryLog:
    if !FileExist(HistoryFile)
        return

    IniRead, hSections, %HistoryFile%
    if (hSections = "ERROR") {
        Warnings.Push("prompts_history.ini exists but has no readable sections")
        return
    }

    hCount := 0
    highestHistory := 0
    Loop Parse, hSections, `n, `r
    {
        hsec := A_LoopField
        if (hsec = "")
            continue
        if !RegExMatch(hsec, "^h(\d+)$", hm) {
            Warnings.Push("prompts_history.ini has unexpected section [" hsec "]")
            continue
        }
        hCount++
        hNum := hm1 + 0
        if (hNum > highestHistory)
            highestHistory := hNum

        IniRead, hts,  %HistoryFile%, %hsec%, timestamp,
        IniRead, hop,  %HistoryFile%, %hsec%, operation,
        IniRead, hsid, %HistoryFile%, %hsec%, snippet_id,
        IniRead, hnm,  %HistoryFile%, %hsec%, name,
        IniRead, hraw, %HistoryFile%, %hsec%, content,

        if (hts = "")
            Warnings.Push("prompts_history.ini [" hsec "] is missing timestamp")
        else if !RegExMatch(hts, "^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$")
            Warnings.Push("prompts_history.ini [" hsec "] timestamp should be yyyy-MM-dd HH:mm:ss")

        if (hop != "edit" && hop != "delete")
            Warnings.Push("prompts_history.ini [" hsec "] operation is """ hop """ (expected edit/delete)")

        if !RegExMatch(hsid, "^\d+$")
            Warnings.Push("prompts_history.ini [" hsec "] snippet_id is not a non-negative integer")

        if (hnm = "")
            Warnings.Push("prompts_history.ini [" hsec "] is missing snippet name")

        if (hraw = "")
            Warnings.Push("prompts_history.ini [" hsec "] has empty content snapshot")
    }

    if (hCount > 100)
        Warnings.Push("prompts_history.ini has " hCount " entries; Prompt Manager prunes to 100 after new history writes")
    if (hCount > 0)
        Info.Push("History entries checked: " hCount " (highest h" highestHistory ")")
return

; ── Report ──────────────────────────────────────────────────
ShowReport:
    errCnt  := Errors.Length()
    warnCnt := Warnings.Length()

    ; category breakdown for stats header
    catCounts := {}
    for id, s in Snippets
    {
        cat := (s.category != "" && s.category != "???") ? s.category : "Custom"
        catCounts[cat] := (catCounts.HasKey(cat) ? catCounts[cat] : 0) + 1
    }
    catLine := ""
    for cat, cnt in catCounts
        catLine .= (catLine ? "  " : "") . cat . ":" . cnt

    report := "Prompt Manager — Health Report`n"
    report .= "========================================`n"
    report .= "Snippets checked : " snippetCount "`n"
    report .= "Categories       : " catLine "`n"
    report .= "Errors           : " errCnt "`n"
    report .= "Warnings         : " warnCnt "`n"
    report .= "========================================`n`n"

    if (errCnt > 0)
    {
        report .= "ERRORS`n------`n"
        for i, msg in Errors
            report .= "  [ERR]  " msg "`n"
        report .= "`n"
    }

    if (warnCnt > 0)
    {
        report .= "WARNINGS`n--------`n"
        for i, msg in Warnings
            report .= "  [WARN] " msg "`n"
        report .= "`n"
    }

    if (errCnt = 0 && warnCnt = 0)
        report .= "  All checks passed.`n"

    if (Info.Length() > 0)
    {
        report .= "`nINFO`n----`n"
        for i, msg in Info
            report .= "  [OK]   " msg "`n"
    }

    if (ConsoleMode)
    {
        FileAppend, %report%, *
        exitCode := (errCnt > 0) ? 2 : (warnCnt > 0) ? 1 : 0
        ExitApp %exitCode%
    }

    ; GUI output
    Gui Report:New, , ValidatePromptManager
    Gui Report:Color, 181825
    Gui Report:Font, s10 cCDD6F4, Consolas
    Gui Report:Add, Edit, x12 y12 w680 h460 ReadOnly +Multi +WantReturn +Background1e1e2e vReportBox
    Gui Report:Font, s10 cCDD6F4, Segoe UI
    if (errCnt > 0)
        Gui Report:Add, Button, x12  y484 w120 h34 gReportClose, Close (Errors)
    else if (warnCnt > 0)
        Gui Report:Add, Button, x12  y484 w120 h34 gReportClose, Close (Warnings)
    else
        Gui Report:Add, Button, x12  y484 w80  h34 gReportClose, Close
    Gui Report:Show, w704 h530, ValidatePromptManager
    GuiControl Report:, ReportBox, %report%

    exitCode := (errCnt > 0) ? 2 : (warnCnt > 0) ? 1 : 0
    return

ReportClose:
ReportGuiClose:
    exitCode := (Errors.Length() > 0) ? 2 : (Warnings.Length() > 0) ? 1 : 0
    ExitApp %exitCode%
    return

GetFileEncoding(path) {
    FileRead, bytes, *c %path%
    if (ErrorLevel)
        return "unreadable"
    b1 := NumGet(bytes, 0, "UChar")
    b2 := NumGet(bytes, 1, "UChar")
    b3 := NumGet(bytes, 2, "UChar")
    if (b1 = 0xFF && b2 = 0xFE)
        return "UTF-16LE"
    if (b1 = 0xFE && b2 = 0xFF)
        return "UTF-16BE"
    if (b1 = 0xEF && b2 = 0xBB && b3 = 0xBF)
        return "UTF-8-BOM"
    return "UTF-8/ANSI"
}
