; Requires Inno Setup 6.7+ for native full-page background support.
#ifndef AppVersion
  #error AppVersion must be supplied by build-setup.ps1
#endif
#define AppName "Hoop League Studio"
#define AppExe "Hoop League Studio.exe"

[Setup]
AppId={{72413B8A-79BA-4C40-9D7A-6D409DA018F3}
AppName={#AppName}
AppVersion={#AppVersion}
AppPublisher={#AppName}
DefaultDirName={localappdata}\Programs\{#AppName}
DefaultGroupName={#AppName}
PrivilegesRequired=lowest
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
OutputDir=..\dist
OutputBaseFilename=Hoop-League-Studio-{#AppVersion}-x64-Setup
SetupIconFile=icon.ico
UninstallDisplayIcon={app}\{#AppExe}
Compression=lzma2
SolidCompression=yes
WizardStyle=modern dark hidebevels
WizardBackColor=#163c69
WizardBackImageFile=..\dist\installer-artwork\background-fit.png
WizardBackImageOpacity=110
WizardImageFile=
WizardSmallImageFile=
DisableWelcomePage=yes
DisableDirPage=no
DisableProgramGroupPage=yes
DisableReadyPage=yes
DisableFinishedPage=no
UsePreviousAppDir=yes
UsePreviousTasks=yes
CloseApplications=yes
RestartApplications=no

[Files]
Source: "..\dist\win-unpacked\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs

[Tasks]
Name: "desktopicon"; Description: "Create a &desktop shortcut"; GroupDescription: "Shortcuts:"
Name: "startmenuicon"; Description: "Add to &Start menu"; GroupDescription: "Shortcuts:"

[Icons]
Name: "{autoprograms}\{#AppName}"; Filename: "{app}\{#AppExe}"; Tasks: startmenuicon
Name: "{autodesktop}\{#AppName}"; Filename: "{app}\{#AppExe}"; Tasks: desktopicon

[Run]
Filename: "{app}\{#AppExe}"; Parameters: "--hls-installer-ready=""{tmp}\hls-ready.tmp"""; Description: "Launch {#AppName}"; Flags: nowait postinstall skipifsilent; BeforeInstall: StartingStudio; AfterInstall: WaitForStudio

[Messages]
SelectDirLabel3=Choose where to install Hoop League Studio.
SelectDirBrowseLabel=Install location
FinishedHeadingLabel=Hoop League Studio is ready
FinishedLabelNoIcons=Installation is complete. Select Finish to start creating your league.

[Code]
type
  { Inno 6 runs the setup UI as a 32-bit process. }
  TSetupMessage = record
    WindowHandle, MessageId, WParam: LongWord;
    LParam: Longint;
    Time: LongWord;
    X, Y: Longint;
    PrivateData: LongWord;
  end;

function PeekMessage(var Msg: TSetupMessage; WindowHandle: HWND;
  MinMessage, MaxMessage, RemoveMessage: LongWord): Boolean;
  external 'PeekMessageW@user32.dll stdcall';
function TranslateMessage(var Msg: TSetupMessage): Boolean;
  external 'TranslateMessage@user32.dll stdcall';
function DispatchMessage(var Msg: TSetupMessage): Longint;
  external 'DispatchMessageW@user32.dll stdcall';

procedure ProcessLaunchMessages;
var
  Msg: TSetupMessage;
  Count: Integer;
begin
  Count := 0;
  while (Count < 32) and PeekMessage(Msg, 0, 0, 0, 1) do
  begin
    { Finish and Cancel are disabled during this bounded wait. Likewise defer
      title-bar close requests until the launch handoff completes. }
    if (Msg.MessageId <> $0010) and
      (not ((Msg.MessageId = $0112) and ((Msg.WParam and $FFF0) = $F060))) then
    begin
      TranslateMessage(Msg);
      DispatchMessage(Msg);
    end;
    Count := Count + 1;
  end;
end;

procedure StartingStudio;
begin
  DeleteFile(ExpandConstant('{tmp}\hls-ready.tmp'));
  WizardForm.FinishedLabel.Caption := 'Opening Hoop League Studio...';
  WizardForm.NextButton.Enabled := False;
  WizardForm.NextButton.Caption := 'Opening...';
  WizardForm.CancelButton.Enabled := False;
  WizardForm.Refresh;
end;

procedure WaitForStudio;
var
  Attempts: Integer;
  Dots: String;
begin
  { The app acknowledges after its first page loads and its window is shown.
    Bound the wait to 30 seconds so a failed launch cannot trap setup. }
  Attempts := 0;
  while (not FileExists(ExpandConstant('{tmp}\hls-ready.tmp'))) and (Attempts < 300) do
  begin
    case (Attempts div 4) mod 3 of
      0: Dots := '.';
      1: Dots := '..';
      2: Dots := '...';
    end;
    WizardForm.FinishedLabel.Caption := 'Opening Hoop League Studio' + Dots;
    ProcessLaunchMessages;
    Sleep(100);
    WizardForm.Refresh;
    Attempts := Attempts + 1;
  end;
  if Attempts = 300 then
    MsgBox('Hoop League Studio is taking longer than expected to open. You can also launch it from your installation folder: ' + ExpandConstant('{app}'), mbInformation, MB_OK);
end;

procedure CurPageChanged(CurPageID: Integer);
begin
  WizardForm.BackButton.Visible := CurPageID = wpSelectTasks;
  if CurPageID = wpSelectDir then
  begin
    WizardForm.PageNameLabel.Caption := 'Hoop League Studio';
    WizardForm.PageDescriptionLabel.Caption := 'A comprehensive league editor for Hoop Land';
    WizardForm.NextButton.Caption := SetupMessage(msgButtonNext);
  end;
  if CurPageID = wpSelectTasks then
  begin
    WizardForm.PageNameLabel.Caption := 'Choose shortcuts';
    WizardForm.PageDescriptionLabel.Caption := 'Choose where you want to find Hoop League Studio.';
    WizardForm.NextButton.Caption := SetupMessage(msgButtonInstall);
  end;
  if CurPageID = wpInstalling then
  begin
    WizardForm.PageNameLabel.Caption := 'Installing Hoop League Studio';
    WizardForm.PageDescriptionLabel.Caption := 'Your studio will be ready shortly.';
    WizardForm.FilenameLabel.Visible := False;
  end;
  if CurPageID = wpFinished then
    WizardForm.NextButton.Caption := SetupMessage(msgButtonFinish);
end;
