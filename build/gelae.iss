; Instalador do Gelaê (Inno Setup 6). Gerado pelo GitHub Actions: .github/workflows/instalador.yml
; Instala só para o usuário (não pede senha de administrador) e não apaga os dados ao desinstalar.

#ifndef Versao
  #define Versao "0.1.0"
#endif

[Setup]
AppId={{7C1B6D2E-5A3F-4C8B-9E21-6A0D4F3B9C11}
AppName=Gelaê
AppVersion={#Versao}
AppPublisher=Gelaê - Cidade Alta
DefaultDirName={localappdata}\Programs\Gelae
DefaultGroupName=Gelaê
DisableProgramGroupPage=yes
PrivilegesRequired=lowest
OutputDir=..\dist
OutputBaseFilename=Instalar-Gelae-{#Versao}
SetupIconFile=gelae.ico
UninstallDisplayIcon={app}\Gelae.exe
Compression=lzma2
SolidCompression=yes
WizardStyle=modern
CloseApplications=force

[Languages]
Name: "pt"; MessagesFile: "compiler:Languages\BrazilianPortuguese.isl"

[Tasks]
Name: "atalho"; Description: "Criar ícone na área de trabalho"; GroupDescription: "Atalhos:"
Name: "iniciar"; Description: "Abrir o Gelaê quando o computador ligar"; GroupDescription: "Atalhos:"; Flags: unchecked

[Files]
Source: "..\dist\Gelae\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs

[Icons]
Name: "{group}\Gelaê"; Filename: "{app}\Gelae.exe"
Name: "{userdesktop}\Gelaê"; Filename: "{app}\Gelae.exe"; Tasks: atalho
Name: "{userstartup}\Gelaê"; Filename: "{app}\Gelae.exe"; Tasks: iniciar

[Run]
Filename: "{app}\Gelae.exe"; Description: "Abrir o Gelaê agora"; Flags: nowait postinstall skipifsilent

[UninstallRun]
Filename: "{cmd}"; Parameters: "/C taskkill /IM Gelae.exe /F"; Flags: runhidden; RunOnceId: "fechar"
