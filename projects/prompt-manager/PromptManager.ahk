; ============================================================
;  Prompt Manager v2 — prompt & snippet library
;  AHK v1  |  Win+Alt+P to toggle  |  Data in prompts.ini
;
;  Auto-fill: {clipboard} {date} {datetime}
;  Composition: @{Snippet Name}
;  Favorites ★ + Usage tracking
;  Sub-categories (group field)
;  Multi-select bulk actions
;  Resizable layout
;  Import/Export full library
;  Live preview expansion toggle
; ============================================================
#NoEnv
#SingleInstance Force
SetBatchLines -1
SetWorkingDir %A_ScriptDir%

; ── Globals ─────────────────────────────────────────────────
DataFile := A_ScriptDir . "\prompts.ini"
Snippets := {}
FilteredIDs := []
NextID := 1
SelectedID := ""
EditorID := ""
FillInAction := ""
FillInContent := ""
FillInPlaceholders := []
FillInCount := 0
PreviewExpanded := 0
FillIn1 := "", FillIn2 := "", FillIn3 := "", FillIn4 := "", FillIn5 := ""
FillIn6 := "", FillIn7 := "", FillIn8 := "", FillIn9 := "", FillIn10 := ""
FillIn11 := "", FillIn12 := "", FillIn13 := "", FillIn14 := "", FillIn15 := ""

; layout state
LW := 0, LPad := 12, LPvX := 0, LPvW := 0, LRow2Y := 0, LBtnY := 0, LStatusY := 0

; ── Dark-mode Edit controls ────────────────────────────────
hBrushEdit := DllCall("CreateSolidBrush", "UInt", 0x443231, "Ptr")
hBrushPreview := DllCall("CreateSolidBrush", "UInt", 0x2e1e1e, "Ptr")
OnMessage(0x0133, "WM_CTLCOLOREDIT")
OnMessage(0x0138, "WM_CTLCOLORSTATIC")

WM_CTLCOLOREDIT(wParam, lParam, msg, hwnd) {
    global hBrushEdit
    DllCall("SetTextColor", "Ptr", wParam, "UInt", 0xF4D6CD)
    DllCall("SetBkColor",   "Ptr", wParam, "UInt", 0x443231)
    return hBrushEdit
}
WM_CTLCOLORSTATIC(wParam, lParam, msg, hwnd) {
    global hBrushPreview
    WinGetClass, cls, ahk_id %lParam%
    if (cls = "Edit") {
        DllCall("SetTextColor", "Ptr", wParam, "UInt", 0xF4D6CD)
        DllCall("SetBkColor",   "Ptr", wParam, "UInt", 0x2e1e1e)
        return hBrushPreview
    }
}

; ── Init ───────────────────────────────────────────────────
IfNotExist, %DataFile%
    GoSub CreateSampleData

GoSub LoadAllSnippets
GoSub BuildMainGUI
return

; ── Global Hotkey ──────────────────────────────────────────
#!p::
    Gui Main:Show, , Prompt Manager
    GuiControl Main:Focus, SearchBox
    return

; ============================================================
;  GUI CONSTRUCTION
; ============================================================
BuildMainGUI:
    Gui Main:New, +Resize +MinSize750x480, Prompt Manager
    Gui Main:Default
    Gui Main:Color, 181825

    ; ── Toolbar ────────────────────────────────────────────
    Gui Font, s11 cCDD6F4, Segoe UI
    Gui Add, Text, x12 y12 w50 h36 +0x200 vLblSearch, Search
    Gui Add, Edit, x66 y12 w192 h26 vSearchBox gOnSearch +Background313244

    Gui Add, Text, x270 y12 w60 h36 +0x200 vLblCat, Category
    Gui Add, DropDownList, x334 y12 w160 vCatFilter gOnCatFilter Choose1, All|Favorites|Most Used

    Gui Font, s9 c6C7086, Segoe UI
    Gui Add, Text, x500 y12 w200 h36 +0x200 vSnippetCount, 0 snippets
    Gui Font, s8 c6C7086, Segoe UI
    Gui Add, Text, x700 y12 w200 h36 +0x200 +Right vHintText, F=Fav  D=Dup  Enter=Paste  Esc=Hide
    Gui Font, s11 cCDD6F4, Segoe UI

    ; ── Snippet list (multi-select enabled) ────────────────
    Gui Add, ListView, x12 y56 w300 h400 vSnippetLV gOnLVSelect +LV0x10000 AltSubmit +Background313244 +cCDD6F4, Name|Cat|#
    LV_ModifyCol(1, 185, "Name")
    LV_ModifyCol(2, 80, "Cat")
    LV_ModifyCol(3, 30, "#")
    LV_ModifyCol(3, "Integer Right")

    ; ── Preview pane ───────────────────────────────────────
    Gui Font, s13 cB4BEFE Bold, Segoe UI
    Gui Add, Text, x324 y56 w400 h24 +0x200 vPreviewTitle, Select a snippet...
    Gui Font, s11 cCDD6F4 Norm, Segoe UI

    ; expand toggle
    Gui Font, s9 cA6ADC8, Segoe UI
    Gui Add, CheckBox, x750 y58 w100 h20 vExpandChk gOnToggleExpand, Expand
    Gui Font, s11 cCDD6F4, Segoe UI

    Gui Font, s9 cFAB387, Segoe UI
    Gui Add, Text, x324 y82 w580 h18 vPreviewTags,
    Gui Font, s10 cCDD6F4, Consolas
    Gui Add, Edit, x324 y104 w580 h352 vPreviewBox ReadOnly +Multi +WantReturn +Background1e1e2e
    Gui Font, s11 cCDD6F4, Segoe UI

    ; ── Buttons ────────────────────────────────────────────
    Gui Font, s10 cCDD6F4, Segoe UI
    Gui Add, Button, x12  y466 w58 h32 gOnAdd      vBtnAdd,    +Add
    Gui Add, Button, x74  y466 w58 h32 gOnDuplicate vBtnDup,   Dup
    Gui Add, Button, x136 y466 w58 h32 gOnEdit     vBtnEdit,   Edit
    Gui Add, Button, x198 y466 w58 h32 gOnDelete   vBtnDel,    Del

    Gui Add, Button, x324 y466 w64  h32 gOnToggleFav vBtnFav,  ★ Fav
    Gui Add, Button, x392 y466 w75  h32 gOnCopy     vBtnCopy,  &Copy
    Gui Add, Button, x471 y466 w105 h32 gOnInsert   vBtnPaste, &Paste+Close
    Gui Add, Button, x580 y466 w80  h32 gOnExportLib vBtnExpLib, Export All
    Gui Add, Button, x664 y466 w80  h32 gOnImportLib vBtnImpLib, Import

    ; ── Status bar ─────────────────────────────────────────
    Gui Font, s9 c6C7086, Segoe UI
    Gui Add, Text, x12  y502 w310 h20 +0x200 vStatusLeft, Ready
    Gui Add, Text, x324 y502 w580 h20 +0x200 +Right vStatusRight, Auto: {clipboard} {date} {datetime}  |  @{Name}
    Gui Font, s11 cCDD6F4, Segoe UI

    GoSub BuildCategoryDropdown
    GoSub RefreshList
    Gui Main:Show, w920 h530, Prompt Manager
return

; ── Resize handler ─────────────────────────────────────────
MainGuiSize:
    if (A_EventInfo = 1) ; minimized
        return
    W := A_GuiWidth, H := A_GuiHeight
    Pad := 12
    ListW := Floor(W * 0.33)
    if (ListW < 220)
        ListW := 220
    PvX := Pad + ListW + Pad
    PvW := W - PvX - Pad
    BtnY := H - 64
    StatusY := H - 28
    Row2Y := 56
    ListH := BtnY - Row2Y - 8

    ; toolbar
    srchW := ListW - 54
    GuiControl Move, SearchBox, % "x66 w" srchW
    catLblX := Pad + ListW + Pad
    GuiControl Move, LblCat, % "x" catLblX
    catDDX := catLblX + 64
    GuiControl Move, CatFilter, % "x" catDDX
    cntX := catDDX + 168
    GuiControl Move, SnippetCount, % "x" cntX
    hintX := W - 212
    GuiControl Move, HintText, % "x" hintX " w200"

    ; list
    GuiControl Move, SnippetLV, % "w" ListW " h" ListH
    LV_ModifyCol(1, ListW - 130)

    ; preview
    GuiControl Move, PreviewTitle, % "x" PvX " w" (PvW - 110)
    expX := W - Pad - 100
    GuiControl Move, ExpandChk, % "x" expX
    GuiControl Move, PreviewTags, % "x" PvX " w" PvW
    pvY := 104
    pvH := BtnY - pvY - 8
    GuiControl Move, PreviewBox, % "x" PvX " w" PvW " h" pvH

    ; buttons
    GuiControl Move, BtnAdd,   % "y" BtnY
    GuiControl Move, BtnDup,   % "y" BtnY
    GuiControl Move, BtnEdit,  % "y" BtnY
    GuiControl Move, BtnDel,   % "y" BtnY
    GuiControl Move, BtnFav,   % "x" PvX " y" BtnY
    bx2 := PvX + 68
    GuiControl Move, BtnCopy,  % "x" bx2 " y" BtnY
    bx3 := bx2 + 79
    GuiControl Move, BtnPaste, % "x" bx3 " y" BtnY
    bx4 := bx3 + 109
    GuiControl Move, BtnExpLib, % "x" bx4 " y" BtnY
    bx5 := bx4 + 84
    GuiControl Move, BtnImpLib, % "x" bx5 " y" BtnY

    ; status
    GuiControl Move, StatusLeft,  % "y" StatusY " w" (PvX - Pad)
    GuiControl Move, StatusRight, % "x" PvX " y" StatusY " w" PvW
    return

; ============================================================
;  EVENT HANDLERS
; ============================================================
OnSearch:
OnCatFilter:
    GoSub RefreshList
    return

OnLVSelect:
    if (A_GuiEvent = "I") {
        Gui Main:Default
        ; count selected
        selCount := 0
        row := 0
        Loop {
            row := LV_GetNext(row)
            if (!row)
                break
            selCount++
            SelectedID := FilteredIDs[row]
        }
        if (selCount = 1) {
            GoSub UpdatePreview
        } else if (selCount > 1) {
            GoSub UpdatePreviewMulti
        }
    }
    if (A_GuiEvent = "DoubleClick" || A_GuiEvent = "A") {
        GoSub OnInsert
    }
    return

UpdatePreviewMulti:
    selIDs := []
    totalChars := 0
    row := 0
    Loop {
        row := LV_GetNext(row)
        if (!row)
            break
        id := FilteredIDs[row]
        selIDs.Push(id)
        totalChars += StrLen(Snippets[id].content)
    }
    cnt := selIDs.Length()
    GuiControl Main:, PreviewTitle, % cnt " snippets selected"
    GuiControl Main:, PreviewTags, % totalChars " chars total  —  Use bulk: Del / ★Fav / Export All"
    ; show combined preview
    combined := ""
    for i, id in selIDs {
        s := Snippets[id]
        if (i > 1)
            combined .= "`n`n--- " s.name " ---`n`n"
        else
            combined .= "--- " s.name " ---`n`n"
        combined .= s.content
    }
    GuiControl Main:, PreviewBox, %combined%
    GuiControl Main:, StatusLeft, % cnt " selected"
    return

UpdatePreview:
    if (SelectedID = "" || !Snippets.HasKey(SelectedID)) {
        GuiControl Main:, PreviewTitle, Select a snippet...
        GuiControl Main:, PreviewTags,
        GuiControl Main:, PreviewBox,
        GuiControl Main:, StatusLeft, Ready
        return
    }
    s := Snippets[SelectedID]
    titleTxt := s.name
    if (s.fav)
        titleTxt := Chr(9733) " " titleTxt
    GuiControl Main:, PreviewTitle, %titleTxt%

    tagLine := s.category
    if (s.group != "")
        tagLine .= "/" s.group
    if (s.tags != "")
        tagLine .= "  —  " s.tags
    if (s.uses > 0)
        tagLine .= "  —  used " s.uses "x"
    GuiControl Main:, PreviewTags, %tagLine%

    ; show raw or expanded
    if (PreviewExpanded)
        GoSub ShowExpandedPreview
    else
        GuiControl Main:, PreviewBox, % s.content

    ; status
    content := s.content
    StringLen, charCnt, content
    phCnt := 0
    phPos := 1
    while (phPos := RegExMatch(content, "\{[^{}\n]+\}", phM, phPos)) {
        phCnt++
        phPos += StrLen(phM)
    }
    incCnt := 0
    incPos := 1
    while (incPos := RegExMatch(content, "@\{[^{}]+\}", incM, incPos)) {
        incCnt++
        incPos += StrLen(incM)
    }
    statusTxt := charCnt " chars"
    if (phCnt > 0)
        statusTxt .= "  |  " phCnt " placeholder" (phCnt > 1 ? "s" : "")
    if (incCnt > 0)
        statusTxt .= "  |  " incCnt " @include" (incCnt > 1 ? "s" : "")
    GuiControl Main:, StatusLeft, %statusTxt%
    return

; ── Preview expansion toggle ──────────────────────────────
OnToggleExpand:
    GuiControlGet, PreviewExpanded, Main:, ExpandChk
    GoSub UpdatePreview
    return

ShowExpandedPreview:
    _ExpandText := Snippets[SelectedID].content
    GoSub ExpandTextIncludes
    ; replace auto-fills
    clipSaved := Clipboard
    StringReplace, _ExpandText, _ExpandText, {clipboard}, %clipSaved%, All
    FormatTime, ad,, yyyy-MM-dd
    StringReplace, _ExpandText, _ExpandText, {date}, %ad%, All
    FormatTime, adt,, yyyy-MM-dd HH:mm
    StringReplace, _ExpandText, _ExpandText, {datetime}, %adt%, All
    GuiControl Main:, PreviewBox, % _ExpandText
    return

; ── Favorites ─────────────────────────────────────────────
OnToggleFav:
    ; works on all selected
    row := 0
    changed := false
    Loop {
        row := LV_GetNext(row)
        if (!row)
            break
        id := FilteredIDs[row]
        if (Snippets.HasKey(id)) {
            Snippets[id].fav := !Snippets[id].fav
            changed := true
        }
    }
    if (!changed)
        return
    GoSub SaveAllSnippets
    GoSub ReselectAfterRefresh
    return

ReselectAfterRefresh:
    ; collect selected IDs
    selIDs := []
    row := 0
    Loop {
        row := LV_GetNext(row)
        if (!row)
            break
        selIDs.Push(FilteredIDs[row])
    }
    GoSub RefreshList
    ; re-select
    for i, sid in selIDs {
        for row, rid in FilteredIDs {
            if (rid = sid) {
                LV_Modify(row, "Select")
                if (i = 1) {
                    LV_Modify(row, "Focus")
                    SelectedID := sid
                }
                break
            }
        }
    }
    GoSub UpdatePreview
    return

; ── Copy / Paste ──────────────────────────────────────────
OnCopy:
    if (SelectedID = "" || !Snippets.HasKey(SelectedID))
        return
    FillInAction := "copy"
    FillInContent := Snippets[SelectedID].content
    GoSub StartFillIn
    return

OnInsert:
    if (SelectedID = "" || !Snippets.HasKey(SelectedID))
        return
    FillInAction := "insert"
    FillInContent := Snippets[SelectedID].content
    GoSub StartFillIn
    return

StartFillIn:
    GoSub ExpandIncludes
    clipSaved := Clipboard
    StringReplace, FillInContent, FillInContent, {clipboard}, %clipSaved%, All
    FormatTime, autoDate,, yyyy-MM-dd
    StringReplace, FillInContent, FillInContent, {date}, %autoDate%, All
    FormatTime, autoDateTime,, yyyy-MM-dd HH:mm
    StringReplace, FillInContent, FillInContent, {datetime}, %autoDateTime%, All
    GoSub ParsePlaceholders
    if (FillInCount = 0) {
        GoSub IncrementUses
        GoSub DoFinalAction
        return
    }
    GoSub ShowFillInDialog
    return

ExpandIncludes:
    _ExpandText := FillInContent
    GoSub ExpandTextIncludes
    FillInContent := _ExpandText
    return

; ── Shared @{include} expansion (operates on _ExpandText) ────
ExpandTextIncludes:
    Loop 20 {
        _etFound := false
        _etPos := 1
        while (_etPos := RegExMatch(_ExpandText, "@\{([^{}]+)\}", _etM, _etPos)) {
            _etName := _etM1
            _etRepl := ""
            for _etSid, _etObj in Snippets {
                if (_etObj.name = _etName) {
                    _etRepl := _etObj.content
                    break
                }
            }
            if (_etRepl != "") {
                StringReplace, _ExpandText, _ExpandText, %_etM%, %_etRepl%,
                _etFound := true
                break
            }
            _etPos += StrLen(_etM)
        }
        if (!_etFound)
            break
    }
    return

IncrementUses:
    if (SelectedID != "" && Snippets.HasKey(SelectedID)) {
        Snippets[SelectedID].uses := Snippets[SelectedID].uses + 1
        GoSub SaveAllSnippets
    }
    return

DoFinalAction:
    if (FillInAction = "copy") {
        Clipboard := FillInContent
        GuiControl Main:, StatusLeft, Copied to clipboard!
        ToolTip Copied!
        SetTimer RemoveTooltip, -1200
    } else {
        Clipboard := FillInContent
        Gui Main:Hide
        Sleep 150
        Send ^v
    }
    GoSub UpdatePreview
    return

; ── Export single / Import-Export library ──────────────────
OnExportLib:
    if (Snippets.Count() = 0) {
        MsgBox 48, Export, No snippets to export.
        return
    }
    ; check if multi-select: export selected, else export all
    selCount := 0
    row := 0
    Loop {
        row := LV_GetNext(row)
        if (!row)
            break
        selCount++
    }
    FileSelectFile, outPath, S16, prompts_export.ini, Export Library, INI Files (*.ini)
    if (outPath = "")
        return
    FileDelete %outPath%
    idx := 0
    if (selCount > 1) {
        ; export selected only
        row := 0
        Loop {
            row := LV_GetNext(row)
            if (!row)
                break
            id := FilteredIDs[row]
            if (!Snippets.HasKey(id))
                continue
            idx++
            GoSub WriteSnippetToFile
        }
    } else {
        ; export all
        for id, s in Snippets {
            idx++
            GoSub WriteSnippetToFile
        }
    }
    GuiControl Main:, StatusLeft, % "Exported " idx " snippets"
    ToolTip % "Exported " idx " snippets!"
    SetTimer RemoveTooltip, -1200
    return

WriteSnippetToFile:
    s := Snippets[id]
    sec := "snippet_" idx
    IniWrite, % s.name,     %outPath%, %sec%, name
    IniWrite, % s.category, %outPath%, %sec%, category
    IniWrite, % s.group,    %outPath%, %sec%, group
    IniWrite, % s.tags,     %outPath%, %sec%, tags
    encoded := s.content
    StringReplace, encoded, encoded, `n, ``n, All
    StringReplace, encoded, encoded, %A_Tab%, ``t, All
    IniWrite, %encoded%,    %outPath%, %sec%, content
    IniWrite, % s.fav,      %outPath%, %sec%, fav
    IniWrite, % s.uses,     %outPath%, %sec%, uses
    return

OnImportLib:
    FileSelectFile, inPath, 3, , Import Library, INI Files (*.ini)
    if (inPath = "")
        return
    imported := 0
    IniRead, sections, %inPath%
    Loop Parse, sections, `n, `r
    {
        sec := A_LoopField
        if (sec = "")
            continue
        RegExMatch(sec, "snippet_(\d+)", m)
        if (!m)
            continue
        IniRead, nm,   %inPath%, %sec%, name, ???
        if (nm = "???")
            continue
        IniRead, cat,  %inPath%, %sec%, category, Custom
        IniRead, grp,  %inPath%, %sec%, group,
        IniRead, tgs,  %inPath%, %sec%, tags,
        IniRead, raw,  %inPath%, %sec%, content, ???
        IniRead, fv,   %inPath%, %sec%, fav, 0
        IniRead, us,   %inPath%, %sec%, uses, 0
        if (grp = "ERROR")
            grp := ""
        if (tgs = "ERROR")
            tgs := ""
        StringReplace, decoded, raw, ``n, `n, All
        StringReplace, decoded, decoded, ``t, %A_Tab%, All
        ; check for duplicate name and generate unique suffix
        dupeSuffix := 0
        Loop {
            dupeFound := false
            checkName := (dupeSuffix = 0) ? nm : nm " (imported " dupeSuffix ")"
            for eid, es in Snippets {
                if (es.name = checkName) {
                    dupeFound := true
                    break
                }
            }
            if (!dupeFound) {
                nm := checkName
                break
            }
            dupeSuffix++
            if (dupeSuffix > 100)
                break
        }
        Snippets[NextID] := {name: nm, category: cat, group: grp, tags: tgs, content: decoded, fav: fv + 0, uses: us + 0}
        NextID++
        imported++
    }
    if (imported > 0) {
        GoSub SaveAllSnippets
        GoSub BuildCategoryDropdown
        GoSub RefreshList
    }
    GuiControl Main:, StatusLeft, % "Imported " imported " snippets"
    ToolTip % "Imported " imported " snippets!"
    SetTimer RemoveTooltip, -1200
    return

; ── Duplicate ─────────────────────────────────────────────
OnDuplicate:
    if (SelectedID = "" || !Snippets.HasKey(SelectedID))
        return
    s := Snippets[SelectedID]
    EditorID := ""
    EdNameVal := s.name " (Copy)"
    EdContentVal := s.content
    EdCatVal := s.category
    EdGroupVal := s.group
    EdTagsVal := s.tags
    GoSub ShowEditorDialog
    return

; ── Add / Edit / Delete ───────────────────────────────────
OnAdd:
    EditorID := ""
    EdNameVal := ""
    EdContentVal := ""
    EdCatVal := "Coding"
    EdGroupVal := ""
    EdTagsVal := ""
    GoSub ShowEditorDialog
    return

OnEdit:
    if (SelectedID = "" || !Snippets.HasKey(SelectedID))
        return
    s := Snippets[SelectedID]
    EditorID := SelectedID
    EdNameVal := s.name
    EdContentVal := s.content
    EdCatVal := s.category
    EdGroupVal := s.group
    EdTagsVal := s.tags
    GoSub ShowEditorDialog
    return

OnDelete:
    ; multi-select aware
    selIDs := []
    row := 0
    Loop {
        row := LV_GetNext(row)
        if (!row)
            break
        selIDs.Push(FilteredIDs[row])
    }
    cnt := selIDs.Length()
    if (cnt = 0)
        return
    if (cnt = 1)
        MsgBox 4, Delete, % "Delete """ Snippets[selIDs[1]].name """?"
    else
        MsgBox 4, Delete, % "Delete " cnt " selected snippets?"
    IfMsgBox Yes
    {
        for i, id in selIDs
            Snippets.Delete(id)
        SelectedID := ""
        GoSub SaveAllSnippets
        GoSub BuildCategoryDropdown
        GoSub RefreshList
        GoSub UpdatePreview
    }
    return

MainGuiClose:
MainGuiEscape:
    Gui Main:Hide
    return

; ── Hotkeys ────────────────────────────────────────────────
#IfWinActive Prompt Manager ahk_class AutoHotkeyGUI

Enter::
    WinGetTitle, at, A
    if (at != "Prompt Manager")
        return
    GuiControlGet, fc, Main:FocusV
    if (fc = "SearchBox") {
        GuiControl Main:Focus, SnippetLV
        return
    }
    GoSub OnInsert
    return

f::
    WinGetTitle, at, A
    if (at != "Prompt Manager") {
        Send f
        return
    }
    GuiControlGet, fc, Main:FocusV
    if (fc = "SearchBox") {
        Send f
        return
    }
    GoSub OnToggleFav
    return

d::
    WinGetTitle, at, A
    if (at != "Prompt Manager") {
        Send d
        return
    }
    GuiControlGet, fc, Main:FocusV
    if (fc = "SearchBox") {
        Send d
        return
    }
    GoSub OnDuplicate
    return

~Tab::
    WinGetTitle, at, A
    if (at != "Prompt Manager")
        return
    GuiControlGet, fc, Main:FocusV
    if (fc = "SearchBox") {
        GuiControl Main:Focus, SnippetLV
        Send {Down}{Up}
    }
    return

~Down::
~Up::
    WinGetTitle, at, A
    if (at != "Prompt Manager")
        return
    GuiControlGet, fc, Main:FocusV
    if (fc = "SearchBox")
        GuiControl Main:Focus, SnippetLV
    return

#IfWinActive

RemoveTooltip:
    ToolTip
    return

; ============================================================
;  PLACEHOLDER FILL-IN DIALOG
; ============================================================
ParsePlaceholders:
    FillInPlaceholders := []
    FillInCount := 0
    seen := {}
    pos := 1
    while (pos := RegExMatch(FillInContent, "\{([^{}\n]+)\}", match, pos)) {
        phName := match1
        if (phName = "clipboard" || phName = "date" || phName = "datetime") {
            pos += StrLen(match)
            continue
        }
        if (!seen.HasKey(phName)) {
            seen[phName] := true
            FillInCount++
            FillInPlaceholders.Push({name: phName, token: match})
            if (FillInCount >= 15)
                break
        }
        pos += StrLen(match)
    }
    return

ShowFillInDialog:
    fiW := 580
    fieldH := 38
    dlgH := 56 + (FillInCount * fieldH) + 12 + 40 + 16
    if (dlgH < 180)
        dlgH := 180
    if (dlgH > 650)
        dlgH := 650
    snippetName := Snippets[SelectedID].name
    Gui FillIn:New, +OwnerMain, Fill in — %snippetName%
    Gui FillIn:Default
    Gui FillIn:Color, 181825
    Gui Font, s12 cB4BEFE Bold, Segoe UI
    Gui Add, Text, x16 y12 w560 h24, Fill in placeholders
    Gui Font, s9 c6C7086 Norm, Segoe UI
    Gui Add, Text, x16 y34 w560 h18, Leave blank to keep as-is. Auto-filled: {clipboard} {date} {datetime}
    yPos := 56
    labelW := 190
    editX := labelW + 24
    editW := fiW - editX - 16
    Loop % FillInCount {
        idx := A_Index
        phName := FillInPlaceholders[idx].name
        Gui Font, s10 cFAB387, Consolas
        Gui Add, Text, x8 y%yPos% w%labelW% h26 +0x200 +Right, {%phName%}
        Gui Font, s10 cCDD6F4, Segoe UI
        editOpt := "x" editX " y" yPos " w" editW " h26 vFillIn" idx " +Background313244"
        Gui Add, Edit, %editOpt%
        yPos += fieldH
    }
    yPos += 12
    btnLabel := (FillInAction = "insert") ? "&Paste+Close" : "&Copy"
    Gui Font, s10 cCDD6F4, Segoe UI
    Gui Add, Button, x16  y%yPos% w90  h34 gFillInSkip,     &Skip
    bx1 := fiW - 350
    Gui Add, Button, x%bx1% y%yPos% w105 h34 gFillInSubmit Default, %btnLabel%
    bx2 := fiW - 236
    Gui Add, Button, x%bx2% y%yPos% w105 h34 gFillInCopyOnly, C&opy Only
    bx3 := fiW - 122
    Gui Add, Button, x%bx3% y%yPos% w106 h34 gFillInCancel, Cancel
    Gui FillIn:Show, w%fiW% h%dlgH%
    GuiControl FillIn:Focus, FillIn1
    return

FillInSubmit:
    Gui FillIn:Submit
    Loop % FillInCount {
        idx := A_Index
        token := FillInPlaceholders[idx].token
        val := FillIn%idx%
        if (val != "")
            StringReplace, FillInContent, FillInContent, %token%, %val%, All
    }
    GoSub IncrementUses
    GoSub DoFinalAction
    return

FillInSkip:
    Gui FillIn:Destroy
    GoSub IncrementUses
    GoSub DoFinalAction
    return

FillInCopyOnly:
    Gui FillIn:Submit
    Loop % FillInCount {
        idx := A_Index
        token := FillInPlaceholders[idx].token
        val := FillIn%idx%
        if (val != "")
            StringReplace, FillInContent, FillInContent, %token%, %val%, All
    }
    GoSub IncrementUses
    Clipboard := FillInContent
    GuiControl Main:, StatusLeft, Copied to clipboard!
    ToolTip Copied!
    SetTimer RemoveTooltip, -1200
    GoSub UpdatePreview
    return

FillInCancel:
FillInGuiClose:
FillInGuiEscape:
    Gui FillIn:Destroy
    return

; ============================================================
;  EDITOR DIALOG (with group/sub-category field)
; ============================================================
ShowEditorDialog:
    edW := 620, edH := 560

    Gui Editor:New, +OwnerMain, % (EditorID = "" ? "Add Snippet" : "Edit Snippet")
    Gui Editor:Default
    Gui Editor:Color, 181825

    Gui Font, s9 c6C7086, Segoe UI
    Gui Add, Text, x16 y14 w50 h20, NAME
    Gui Font, s11 cCDD6F4, Segoe UI
    Gui Add, Edit, x16 y34 w588 h28 vEdName +Background313244, %EdNameVal%

    ; Category (ComboBox for freeform) + Group + Tags
    Gui Font, s9 c6C7086, Segoe UI
    Gui Add, Text, x16 y72 w80 h20, CATEGORY
    Gui Font, s11 cCDD6F4, Segoe UI
    ; build category list from existing
    edCatList := "Coding|Writing|System|Workflow|Custom"
    for eid, es in Snippets {
        found := false
        Loop Parse, edCatList, |
            if (A_LoopField = es.category)
                found := true
        if (!found && es.category != "")
            edCatList .= "|" es.category
    }
    Gui Add, ComboBox, x16 y92 w130 vEdCat, %edCatList%
    GuiControl Editor:Text, EdCat, %EdCatVal%

    Gui Font, s9 c6C7086, Segoe UI
    Gui Add, Text, x158 y72 w60 h20, GROUP
    Gui Font, s11 cCDD6F4, Segoe UI
    ; build group list from existing
    edGrpList := ""
    grpSeen := {}
    for eid, es in Snippets {
        if (es.group != "" && !grpSeen.HasKey(es.group)) {
            grpSeen[es.group] := true
            edGrpList .= "|" es.group
        }
    }
    Gui Add, ComboBox, x158 y92 w120 vEdGroup, %edGrpList%
    GuiControl Editor:Text, EdGroup, %EdGroupVal%

    Gui Font, s9 c6C7086, Segoe UI
    Gui Add, Text, x290 y72 w50 h20, TAGS
    Gui Font, s11 cCDD6F4, Segoe UI
    Gui Add, Edit, x290 y92 w314 h28 vEdTags +Background313244, %EdTagsVal%

    Gui Font, s9 c6C7086, Segoe UI
    Gui Add, Text, x16 y130 w80 h20, CONTENT
    Gui Font, s9 cA6ADC8, Segoe UI
    Gui Add, Text, x100 y130 w504 h20, {placeholder}  {clipboard}  {date}  {datetime}  @{Name}
    Gui Font, s10 cCDD6F4, Consolas
    Gui Add, Edit, x16 y150 w588 h350 vEdContent +Multi +WantReturn +WantTab +Background1e1e2e, %EdContentVal%

    Gui Font, s10 cCDD6F4, Segoe UI
    bY := edH - 52
    Gui Add, Button, x400 y%bY% w104 h36 gEditorSave Default, &Save
    Gui Add, Button, x512 y%bY% w92  h36 gEditorCancel, Cancel

    Gui Editor:Show, w%edW% h%edH%
return

EditorSave:
    Gui Editor:Submit, NoHide
    if (EdName = "") {
        MsgBox 48, Error, Name cannot be empty.
        return
    }
    Gui Editor:Destroy
    if (EditorID = "") {
        id := NextID
        NextID++
    } else {
        id := EditorID
    }
    oldFav := 0, oldUses := 0
    if (Snippets.HasKey(id)) {
        oldFav := Snippets[id].fav
        oldUses := Snippets[id].uses
    }
    Snippets[id] := {name: EdName, category: EdCat, group: EdGroup, tags: EdTags, content: EdContent, fav: oldFav, uses: oldUses}
    GoSub SaveAllSnippets
    Gui Main:Default
    GoSub BuildCategoryDropdown
    GoSub RefreshList
    ; select the saved snippet
    for row, rid in FilteredIDs {
        if (rid = id) {
            LV_Modify(row, "Select Focus")
            SelectedID := id
            GoSub UpdatePreview
            break
        }
    }
    return

EditorCancel:
EditorGuiClose:
EditorGuiEscape:
    Gui Editor:Destroy
    return

; ============================================================
;  BUILD CATEGORY DROPDOWN (dynamic with sub-categories)
; ============================================================
BuildCategoryDropdown:
    Gui Main:Default
    ; collect unique category and category/group combos
    baseCats := ["Coding","Writing","System","Workflow","Custom"]
    catSet := {}
    for id, s in Snippets {
        if (s.category != "")
            catSet[s.category] := true
    }
    ; add any custom categories not in base list
    for cat, v in catSet {
        found := false
        for i, bc in baseCats
            if (bc = cat)
                found := true
        if (!found)
            baseCats.Push(cat)
    }
    ; build group entries
    groupEntries := {}
    for id, s in Snippets {
        if (s.group != "" && s.category != "") {
            key := s.category "/" s.group
            groupEntries[key] := true
        }
    }
    ; build dropdown string
    ddList := "All|Favorites|Most Used"
    for i, cat in baseCats
        ddList .= "|" cat
    for key, v in groupEntries
        ddList .= "|  " key   ; indented
    GuiControl Main:, CatFilter, |%ddList%
    GuiControl Main:Choose, CatFilter, 1
    return

; ============================================================
;  REFRESH LIST
; ============================================================
RefreshList:
    Gui Main:Default
    GuiControlGet, searchTerm, Main:, SearchBox
    GuiControlGet, catText, Main:, CatFilter

    ; trim whitespace from indented group entries
    catText := RegExReplace(catText, "^\s+")

    StringLower, searchTerm, searchTerm

    LV_Delete()
    FilteredIDs := []

    sortLines := ""
    for id, s in Snippets {
        ; category filter
        if (catText = "All") {
            ; show all
        } else if (catText = "Favorites") {
            if (!s.fav)
                continue
        } else if (catText = "Most Used") {
            if (s.uses < 1)
                continue
        } else if (InStr(catText, "/")) {
            ; sub-category filter: "Coding/Python"
            snippetFull := s.category
            if (s.group != "")
                snippetFull .= "/" s.group
            if (snippetFull != catText)
                continue
        } else {
            ; plain category
            if (s.category != catText)
                continue
        }
        ; search
        if (searchTerm != "") {
            haystack := s.name " " s.tags " " s.group " " s.content
            StringLower, haystack, haystack
            if !InStr(haystack, searchTerm)
                continue
        }
        favKey := s.fav ? "0" : "1"
        usesKey := 99999 - s.uses
        if (usesKey < 0)
            usesKey := 0
        usesPad := SubStr("00000" . usesKey, -4)
        nameLower := s.name
        StringLower, nameLower, nameLower
        sep := Chr(1)
        sortLines .= favKey . sep . usesPad . sep . nameLower . sep . id "`n"
    }

    Sort sortLines

    sep := Chr(1)
    Loop Parse, sortLines, `n, `r
    {
        if (A_LoopField = "")
            continue
        StringGetPos, lastSep, A_LoopField, %sep%, R
        id := SubStr(A_LoopField, lastSep + 2) + 0
        if (!Snippets.HasKey(id))
            continue
        s := Snippets[id]
        FilteredIDs.Push(id)
        dispName := s.name
        if (s.fav)
            dispName := Chr(9733) " " dispName
        dispCat := s.category
        if (s.group != "")
            dispCat .= "/" s.group
        LV_Add("", dispName, dispCat, s.uses)
    }

    ; count badge
    total := Snippets.Count()
    shown := FilteredIDs.Length()
    if (catText = "Favorites")
        cntTxt := shown " fav" (shown != 1 ? "s" : "")
    else if (catText = "Most Used")
        cntTxt := shown " used"
    else if (shown = total)
        cntTxt := total " snippets"
    else
        cntTxt := shown " / " total
    GuiControl Main:, SnippetCount, %cntTxt%

    if (FilteredIDs.Length() > 0) {
        LV_Modify(1, "Select Focus")
        SelectedID := FilteredIDs[1]
        GoSub UpdatePreview
    } else {
        SelectedID := ""
        GoSub UpdatePreview
    }
return

; ============================================================
;  DATA I/O (with group field)
; ============================================================
LoadAllSnippets:
    Snippets := {}
    NextID := 1
    IniRead, sections, %DataFile%
    Loop Parse, sections, `n, `r
    {
        sec := A_LoopField
        if (sec = "")
            continue
        RegExMatch(sec, "snippet_(\d+)", m)
        if (!m)
            continue
        id := m1 + 0
        IniRead, nm,   %DataFile%, %sec%, name, ???
        IniRead, cat,  %DataFile%, %sec%, category, Custom
        IniRead, grp,  %DataFile%, %sec%, group,
        IniRead, tgs,  %DataFile%, %sec%, tags,
        IniRead, raw,  %DataFile%, %sec%, content, ???
        IniRead, fv,   %DataFile%, %sec%, fav, 0
        IniRead, us,   %DataFile%, %sec%, uses, 0
        StringReplace, decoded, raw, ``n, `n, All
        StringReplace, decoded, decoded, ``t, %A_Tab%, All
        if (grp = "ERROR")
            grp := ""
        if (tgs = "ERROR")
            tgs := ""
        Snippets[id] := {name: nm, category: cat, group: grp, tags: tgs, content: decoded, fav: fv + 0, uses: us + 0}
        if (id >= NextID)
            NextID := id + 1
    }
return

SaveAllSnippets:
    FileDelete %DataFile%
    for id, s in Snippets {
        sec := "snippet_" id
        IniWrite, % s.name,     %DataFile%, %sec%, name
        IniWrite, % s.category, %DataFile%, %sec%, category
        IniWrite, % s.group,    %DataFile%, %sec%, group
        IniWrite, % s.tags,     %DataFile%, %sec%, tags
        encoded := s.content
        StringReplace, encoded, encoded, `n, ``n, All
        StringReplace, encoded, encoded, %A_Tab%, ``t, All
        IniWrite, %encoded%,    %DataFile%, %sec%, content
        IniWrite, % s.fav,      %DataFile%, %sec%, fav
        IniWrite, % s.uses,     %DataFile%, %sec%, uses
    }
return

; ============================================================
;  SAMPLE DATA
; ============================================================
CreateSampleData:
    samples := []

    samples.Push({name: "Code Review", category: "Coding", group: "", tags: "review quality", fav: 1, uses: 0
        , content: "Review the following code for bugs, security issues, and improvements.`n`nCode:`n```{language}`n{clipboard}`n````n`nProvide:`n1. Critical bugs or security issues`n2. Performance improvements`n3. Readability suggestions`n4. A summary rating (1-5)"})

    samples.Push({name: "Explain Code", category: "Coding", group: "", tags: "explain understand", fav: 0, uses: 0
        , content: "Explain the following code step by step. Assume I'm an intermediate developer.`n`n```{language}`n{clipboard}`n````n`nCover:`n- What it does overall`n- Key logic flow`n- Any non-obvious patterns or tricks used"})

    samples.Push({name: "Write Unit Tests", category: "Coding", group: "Testing", tags: "testing unit", fav: 0, uses: 0
        , content: "Write comprehensive unit tests for the following function/class.`n`nCode:`n```{language}`n{clipboard}`n````n`nRequirements:`n- Cover happy path and edge cases`n- Use {test framework} style`n- Include descriptive test names`n- Add brief comments explaining each test case"})

    samples.Push({name: "Refactor This", category: "Coding", group: "", tags: "refactor clean", fav: 0, uses: 0
        , content: "Refactor the following code to improve readability and maintainability while preserving exact behavior.`n`n```{language}`n{clipboard}`n````n`nPriorities:`n- Clearer naming`n- Reduce nesting / complexity`n- Extract reusable pieces if warranted`n- Keep it simple — don't over-engineer"})

    samples.Push({name: "Fix Bug", category: "Coding", group: "", tags: "debug fix", fav: 1, uses: 0
        , content: "I have a bug in the following code.`n`nCode:`n```{language}`n{clipboard}`n````n`nExpected behavior: {describe expected}`nActual behavior: {describe actual}`nError message (if any): {paste error}`n`nFind the root cause and provide a fix with explanation."})

    samples.Push({name: "Write Regex", category: "Coding", group: "", tags: "regex pattern", fav: 0, uses: 0
        , content: "Write a regular expression that matches the following pattern:`n`nDescription: {describe what to match}`nLanguage/flavor: {language or PCRE/JS/Python}`n`nProvide the regex, explain each part, and include test cases."})

    samples.Push({name: "Convert Code", category: "Coding", group: "", tags: "translate port", fav: 0, uses: 0
        , content: "Convert the following code from {source language} to {target language}.`n`n```{source language}`n{clipboard}`n````n`nUse idiomatic {target language} patterns. Note any features that don't translate directly."})

    samples.Push({name: "Optimize Performance", category: "Coding", group: "", tags: "performance speed", fav: 0, uses: 0
        , content: "Optimize the following code for better performance.`n`n```{language}`n{clipboard}`n````n`nProvide:`n1. Identified bottlenecks`n2. Optimized version`n3. Big-O analysis before and after"})

    samples.Push({name: "Write SQL Query", category: "Coding", group: "SQL", tags: "sql database", fav: 0, uses: 0
        , content: "Write a SQL query for: {describe the desired output}`n`nDatabase: {PostgreSQL / MySQL / SQLite}`nTables: {describe tables and key columns}`n`nOptimize for readability. Handle NULLs appropriately."})

    samples.Push({name: "API Endpoint Design", category: "Coding", group: "", tags: "api rest design", fav: 0, uses: 0
        , content: "Design a REST API endpoint.`n`nFeature: {describe the feature}`nFramework: {framework}`n`nProvide: method, path, request/response format, validation, implementation code, example curl."})

    samples.Push({name: "Git Commit Message", category: "Coding", group: "Git", tags: "git commit", fav: 0, uses: 0
        , content: "Write a git commit message for:`n`nFiles changed: {list files}`nWhat was done: {describe changes}`n`nUse conventional commits (feat/fix/refactor/docs/chore). Subject under 72 chars."})

    samples.Push({name: "Professional Email Reply", category: "Writing", group: "Email", tags: "email business", fav: 0, uses: 0
        , content: "Write a professional email reply.`n`nOriginal email summary: {summarize the email}`nKey points: {your points}`nTone: {friendly / formal / firm}`n`nKeep it under 150 words. Be polite and action-oriented."})

    samples.Push({name: "Summarize Text", category: "Writing", group: "", tags: "summary tldr", fav: 1, uses: 0
        , content: "Summarize the following text concisely.`n`nText:`n---`n{clipboard}`n---`n`nProvide:`n1. One-sentence TL;DR`n2. 3-5 bullet point summary`n3. Key takeaways or action items"})

    samples.Push({name: "Rewrite for Clarity", category: "Writing", group: "", tags: "rewrite clarity", fav: 0, uses: 0
        , content: "Rewrite this text to be clearer and more concise while keeping the original meaning.`n`nOriginal:`n---`n{clipboard}`n---`n`nTarget audience: {audience}`nMax length: ~{X} words"})

    samples.Push({name: "Proofread and Edit", category: "Writing", group: "", tags: "proofread grammar", fav: 0, uses: 0
        , content: "Proofread and edit the following text.`n`n---`n{clipboard}`n---`n`nFix grammar, spelling, awkward phrasing, punctuation. Provide corrected version then list each change."})

    samples.Push({name: "Translate Text", category: "Writing", group: "", tags: "translate language", fav: 0, uses: 0
        , content: "Translate from {source language} to {target language}.`n`n---`n{clipboard}`n---`n`nMaintain original tone. Use natural phrasing. Note untranslatable idioms."})

    samples.Push({name: "Write Bullet Points", category: "Writing", group: "", tags: "bullets list", fav: 0, uses: 0
        , content: "Convert these notes into clean, organized bullet points.`n`n---`n{clipboard}`n---`n`nGroup related items under headers. Remove redundancy. Use parallel structure."})

    samples.Push({name: "LinkedIn Post", category: "Writing", group: "Social", tags: "linkedin social", fav: 0, uses: 0
        , content: "Write a LinkedIn post.`n`nTopic: {topic}`nKey message: {what you want to convey}`nTone: {professional / casual-professional}`n`nHook in first line. Under 200 words. End with CTA. Suggest 3-5 hashtags."})

    samples.Push({name: "Meeting Notes Cleanup", category: "Writing", group: "", tags: "meeting notes", fav: 0, uses: 0
        , content: "Clean up these raw meeting notes.`n`n---`n{clipboard}`n---`n`nFormat as: ## Meeting: {topic}`n**Date:** {date} | **Attendees:** {names}`n### Key Decisions`n### Action Items`n### Notes"})

    samples.Push({name: "System Prompt Template", category: "System", group: "", tags: "system persona", fav: 0, uses: 0
        , content: "You are {role/persona}. Your expertise includes {domains}.`n`nBehavior rules:`n- {rule 1}`n- {rule 2}`n`nResponse style:`n- Be {concise/detailed/technical}`n- Format output as {format}"})

    samples.Push({name: "Chain of Thought", category: "System", group: "", tags: "cot reasoning", fav: 1, uses: 0
        , content: "Think through this step by step before answering.`n`nQuestion: {your question}`n`n1. Identify what information is given`n2. Break the problem into parts`n3. Work through each part showing reasoning`n4. Check for errors`n5. Provide clear final answer"})

    samples.Push({name: "Few-Shot Template", category: "System", group: "", tags: "few-shot examples", fav: 0, uses: 0
        , content: "Follow the pattern from these examples.`n`nExample 1:`nInput: {example input 1}`nOutput: {example output 1}`n`nExample 2:`nInput: {example input 2}`nOutput: {example output 2}`n`nNow do:`nInput: {your actual input}`nOutput:"})

    samples.Push({name: "Output Format Enforcer", category: "System", group: "", tags: "format json", fav: 0, uses: 0
        , content: "Respond ONLY with valid {format}. No explanations, no markdown fencing.`n`nSchema: {paste schema}`nExample output: {example}`n`nProcess this input: {input}"})

    samples.Push({name: "Role: Senior Developer", category: "System", group: "Roles", tags: "role developer", fav: 1, uses: 0
        , content: "You are a senior software developer with 15+ years of experience.`n`nExpertise: {languages/frameworks}`n`nRules:`n- Production-ready code, not toy examples`n- Consider error handling, edge cases, security`n- Explain architectural decisions`n- Prefer simplicity over cleverness"})

    samples.Push({name: "Role: Technical Writer", category: "System", group: "Roles", tags: "role writer", fav: 0, uses: 0
        , content: "You are a technical writer creating clear documentation.`n`nRules:`n- Plain language, avoid jargon`n- Headers, lists, code examples`n- Include quick-start / TL;DR`n- Active voice, second person`n- Sentences under 25 words"})

    samples.Push({name: "Guardrails Template", category: "System", group: "", tags: "safety guardrails", fav: 0, uses: 0
        , content: "Follow these guardrails strictly:`n`nALWAYS:`n- Stay on topic: {allowed topics}`n- Cite sources for factual claims`n- Ask clarifying questions if ambiguous`n`nNEVER:`n- {prohibited behavior 1}`n- {prohibited behavior 2}`n- Make up information"})

    samples.Push({name: "Daily Standup Notes", category: "Workflow", group: "", tags: "standup daily", fav: 0, uses: 0
        , content: "Format my standup notes:`n`nYesterday: {what you did}`nToday: {what you plan}`nBlockers: {any blockers}`n`nConcise bullet points. Highlight items needing attention."})

    samples.Push({name: "Convert Format", category: "Workflow", group: "", tags: "convert transform", fav: 0, uses: 0
        , content: "Convert from {source format} to {target format}.`n`nInput:`n````n{clipboard}`n````n`nPreserve all fields. Handle edge cases. Output valid and well-formatted."})

    samples.Push({name: "Create Documentation", category: "Workflow", group: "", tags: "docs documentation", fav: 0, uses: 0
        , content: "Write documentation for:`n`n````n{clipboard}`n````n`nInclude: overview, parameters, usage examples, common gotchas. Markdown format."})

    samples.Push({name: "Compare Options", category: "Workflow", group: "", tags: "compare decision", fav: 0, uses: 0
        , content: "Compare these options:`n1. {option 1}`n2. {option 2}`n3. {option 3}`n`nContext: {what this is for}`nPriorities: {cost / speed / quality / simplicity}`n`nPros/cons for each. Comparison table. Recommendation."})

    samples.Push({name: "Break Down Task", category: "Workflow", group: "Planning", tags: "planning breakdown", fav: 0, uses: 0
        , content: "Break down this task:`n`nTask: {describe the task}`nDeadline: {when}`n`nProvide: ordered sub-tasks with effort estimates, dependencies, critical path, risks."})

    samples.Push({name: "Write Changelog", category: "Workflow", group: "", tags: "changelog release", fav: 0, uses: 0
        , content: "Write a changelog for version {version}.`n`nChanges: {list changes}`n`nUse Keep a Changelog style (Added/Changed/Fixed/Removed). Write for end users."})

    samples.Push({name: "Incident Post-Mortem", category: "Workflow", group: "", tags: "incident postmortem", fav: 0, uses: 0
        , content: "Write a post-mortem.`n`nIncident: {brief description}`nSeverity: {low/medium/high/critical}`nDuration: {how long}`nImpact: {who affected}`n`nFormat: Timeline, Root Cause, Resolution, Lessons, Action Items."})

    samples.Push({name: "Explain Like I'm 5", category: "Workflow", group: "", tags: "eli5 explain", fav: 0, uses: 0
        , content: "Explain simply, as if to someone with no background.`n`nConcept: {concept}`n`nUse everyday analogies, short sentences, no jargon, a concrete example. Then a slightly more technical version."})

    samples.Push({name: "Deep Code Review", category: "Coding", group: "Composed", tags: "review compose", fav: 0, uses: 0
        , content: "@{Role: Senior Developer}`n`n---`n`n@{Code Review}"})

    samples.Push({name: "Structured Explanation", category: "Coding", group: "Composed", tags: "explain compose", fav: 0, uses: 0
        , content: "@{Chain of Thought}`n`n---`n`n@{Explain Code}`n`n---`n`nFormat with clear headers and code comments."})

    for i, s in samples {
        sec := "snippet_" i
        IniWrite, % s.name,     %DataFile%, %sec%, name
        IniWrite, % s.category, %DataFile%, %sec%, category
        IniWrite, % s.group,    %DataFile%, %sec%, group
        IniWrite, % s.tags,     %DataFile%, %sec%, tags
        encoded := s.content
        StringReplace, encoded, encoded, `n, ``n, All
        StringReplace, encoded, encoded, %A_Tab%, ``t, All
        IniWrite, %encoded%,    %DataFile%, %sec%, content
        IniWrite, % s.fav,      %DataFile%, %sec%, fav
        IniWrite, % s.uses,     %DataFile%, %sec%, uses
    }
return
