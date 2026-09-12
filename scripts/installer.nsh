!macro customInstall
  ; The unchanged application GUID lets electron-builder uninstall the former
  ; X Launcher package during upgrades. Remove any orphaned legacy shortcuts
  ; left behind by older installer versions as a final migration step.
  Delete "$DESKTOP\X Launcher.lnk"
  Delete "$SMPROGRAMS\X Launcher.lnk"
  RMDir "$SMPROGRAMS\X Launcher"
!macroend
