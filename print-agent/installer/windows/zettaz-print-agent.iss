#define MyAppName "Zettaz Print Agent"
#define MyAppVersion "2.0.0-dev"
#define MyAppPublisher "Zettaz"
#define MyAppURL "https://cloud.zettaz.com"
#define MyAppExeName "zettaz-print-agent.exe"
#define MyAppServiceName "ZettazPrintAgent"

[Setup]
AppId={{6B4E8D2C-6B4E-4D2C-8D2C-6B4E8D2C6B4E}}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher={#MyAppPublisher}
AppURL={#MyAppURL}
DefaultDirName={commonpf}\{#MyAppName}
DefaultGroupName={#MyAppName}
DisableProgramGroupPage=yes
OutputDir=.\output
OutputBaseFilename=zettaz-print-agent-setup
Compression=lzma
SolidCompression=yes
PrivilegesRequired=admin
ArchitecturesAllowed=x64 arm64
ArchitecturesInstallIn64BitMode=x64 arm64

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"

[Tasks]
Name: "installservice"; Description: "Run as a Windows service"; GroupDescription: "Service:"

[Files]
Source: "..\..\zettaz-print-agent.exe"; DestDir: "{app}"; Flags: ignoreversion
Source: "..\..\README.md"; DestDir: "{app}"; Flags: ignoreversion
Source: "..\..\PROJECT_STATUS.md"; DestDir: "{app}"; Flags: ignoreversion isreadme

[Run]
Filename: "{sys}\sc.exe"; Parameters: "create ""{#MyAppServiceName}"" binPath= ""{app}\{#MyAppExeName}"" start= auto DisplayName= ""{#MyAppName}"""; StatusMsg: "Installing service..."; Flags: runhidden waituntilterminated; Tasks: installservice
Filename: "{sys}\sc.exe"; Parameters: "start ""{#MyAppServiceName}"""; StatusMsg: "Starting service..."; Flags: runhidden waituntilterminated; Tasks: installservice

[UninstallRun]
Filename: "{sys}\sc.exe"; Parameters: "stop ""{#MyAppServiceName}"""; Flags: runhidden waituntilterminated
Filename: "{sys}\sc.exe"; Parameters: "delete ""{#MyAppServiceName}"""; Flags: runhidden waituntilterminated

[Icons]
Name: "{group}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"
