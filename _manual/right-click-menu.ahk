; AutoHotkey v1.1 - Text transformation menu (Alt + Right Click)

; --- Submenus ---

Menu, CaseMenu, Add, Title Case,          TransformHandler
Menu, CaseMenu, Add, Upper Case,          TransformHandler
Menu, CaseMenu, Add, Lower Case,          TransformHandler
Menu, CaseMenu, Add, Sentence Case,       TransformHandler

Menu, ConvertMenu, Add, camelCase,        TransformHandler
Menu, ConvertMenu, Add, PascalCase,       TransformHandler
Menu, ConvertMenu, Add, snake_case,       TransformHandler
Menu, ConvertMenu, Add, kebab-case,       TransformHandler

Menu, FormatMenu, Add, Trim Whitespace,    TransformHandler
Menu, FormatMenu, Add, Remove Line Breaks, TransformHandler
Menu, FormatMenu, Add, Remove Blank Lines, TransformHandler

Menu, WrapMenu, Add, Double Quotes,       TransformHandler
Menu, WrapMenu, Add, Single Quotes,       TransformHandler
Menu, WrapMenu, Add, Backticks,           TransformHandler

; --- Root Menu ---

Menu, TextMenu, Add, Case,               :CaseMenu
Menu, TextMenu, Add, Convert,            :ConvertMenu
Menu, TextMenu, Add, Format,             :FormatMenu
Menu, TextMenu, Add, Wrap,               :WrapMenu
Menu, TextMenu, Add
Menu, TextMenu, Add, Word && Char Count, CountHandler

Alt & RButton::Menu, TextMenu, Show

; --- Handlers ---

TransformHandler:
    Sleep 100
    Switch A_ThisMenuItem
    {
        Case "Title Case":          Regex_ClipboardHandler("TitleCase")
        Case "Upper Case":          Regex_ClipboardHandler("UpperCase")
        Case "Lower Case":          Regex_ClipboardHandler("LowerCase")
        Case "Sentence Case":       Regex_ClipboardHandler("SentenceCase")
        Case "camelCase":           Regex_ClipboardHandler("ToCamelCase")
        Case "PascalCase":          Regex_ClipboardHandler("ToPascalCase")
        Case "snake_case":          Regex_ClipboardHandler("ToSnakeCase")
        Case "kebab-case":          Regex_ClipboardHandler("ToKebabCase")
        Case "Trim Whitespace":     Regex_ClipboardHandler("TrimWhitespace")
        Case "Remove Line Breaks":  Regex_ClipboardHandler("RemoveLineBreaks")
        Case "Remove Blank Lines":  Regex_ClipboardHandler("RemoveBlankLines")
        Case "Double Quotes":       Regex_ClipboardHandler("WrapDoubleQuotes")
        Case "Single Quotes":       Regex_ClipboardHandler("WrapSingleQuotes")
        Case "Backticks":           Regex_ClipboardHandler("WrapBackticks")
    }
return

CountHandler:
    Sleep 100
    oldclip := Clipboard
    Clipboard =
    SendInput, ^c
    ClipWait 1
    if (Clipboard = "") {
        ToolTip, Select text first
        SetTimer, ClearToolTip, -1500
        Clipboard := oldclip
        return
    }
    text := Clipboard
    Clipboard := oldclip

    charCount := StrLen(text)
    wordCount := 0
    Loop, Parse, text, %A_Space%%A_Tab%`n`r
        if (A_LoopField != "")
            wordCount++
    lineCount := 0
    Loop, Parse, text, `n, `r
        lineCount++

    MsgBox % "Characters: " . charCount . "`nWords: " . wordCount . "`nLines: " . lineCount
return

ClearToolTip:
    ToolTip
return

; --- Clipboard Transform Helper ---

Regex_ClipboardHandler(regexLogic, optionalParam1="") {
    function := Func(regexLogic)
    oldclip := Clipboard
    Clipboard =
    SendInput, ^c
    ClipWait 1
    if (Clipboard = "") {
        ToolTip, Select text first
        SetTimer, ClearToolTip, -1500
        Clipboard := oldclip
        return
    }
    if (optionalParam1 = "")
        Clipboard := function.Call(Clipboard)
    else
        Clipboard := function.Call(Clipboard, optionalParam1)
    Sleep 100
    SendInput, ^v
    Sleep 200
    Clipboard := oldclip
}

; --- Transform Functions ---

TitleCase(str) {
    StringUpper, str, str, T
    return SubStr(str, 1, 2) . SomeLower(SubStr(str, 3))
}

SentenceCase(str) {
    StringLower, str, str
    first := SubStr(str, 1, 1)
    StringUpper, first, first
    return first . SubStr(str, 2)
}

UpperCase(str) {
    StringUpper, str, str
    return str
}

LowerCase(str) {
    StringLower, str, str
    return str
}

ToCamelCase(str) {
    StringLower, str, str
    str := RegExReplace(str, "[ _\-]+([a-z])", "${U:1}")
    return str
}

ToPascalCase(str) {
    StringLower, str, str
    str := RegExReplace(str, "[ _\-]+([a-z])", "${U:1}")
    first := SubStr(str, 1, 1)
    StringUpper, first, first
    return first . SubStr(str, 2)
}

ToSnakeCase(str) {
    str := RegExReplace(str, "([a-z])([A-Z])", "$1_$2")
    StringLower, str, str
    str := RegExReplace(str, "[ \-]+", "_")
    str := RegExReplace(str, "[^a-z0-9_]", "")
    return str
}

ToKebabCase(str) {
    str := RegExReplace(str, "([a-z])([A-Z])", "$1-$2")
    StringLower, str, str
    str := RegExReplace(str, "[ _]+", "-")
    str := RegExReplace(str, "[^a-z0-9\-]", "")
    return str
}

TrimWhitespace(str) {
    return RegExReplace(str, "m)^\s+|\s+$", "")
}

RemoveLineBreaks(str) {
    str := RegExReplace(str, "\r\n|\r|\n", " ")
    str := RegExReplace(str, " {2,}", " ")
    return Trim(str)
}

RemoveBlankLines(str) {
    return RegExReplace(str, "(\r\n|\r|\n)[ \t]*(\r\n|\r|\n)+", "`r`n")
}

WrapDoubleQuotes(str) {
    return """" . str . """"
}

WrapSingleQuotes(str) {
    return "'" . str . "'"
}

WrapBackticks(str) {
    return "``" . str . "``"
}

; Lowercases APA small words for TitleCase
SomeLower(str) {
    replacements := {" And ": " and ", " As ": " as ", " But ": " but "
                   , " For ": " for ", " If ": " if ", " Nor ": " nor "
                   , " Or ": " or ", " So ": " so ", " Yet ": " yet "
                   , " A ": " a ", " An ": " an ", " The ": " the "
                   , " At ": " at ", " By ": " by ", " In ": " in "
                   , " Of ": " of ", " Off ": " off ", " On ": " on "
                   , " Per ": " per ", " To ": " to ", " Up ": " up "
                   , " Via ": " via "}
    for what, with in replacements
        StringReplace, str, str, %what%, %with%, All
    return str
}
