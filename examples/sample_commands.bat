
@echo off
REM Example raw Sonic Annotator commands (edit paths)

SET SONIC="C:\AudioTools\sonic-annotator\sonic-annotator.exe"
SET VAMPPATH=C:\AudioTools\vamp
SET AUDIO="C:\music\song.wav"

%SONIC% --plugin-path %VAMPPATH% -d vamp:qm-vamp-plugins:qm-tempotracker:tempo -w csv --csv-stdout %AUDIO%
%SONIC% --plugin-path %VAMPPATH% -d vamp:qm-vamp-plugins:qm-barbeattracker:beats -w csv --csv-stdout %AUDIO%
%SONIC% --plugin-path %VAMPPATH% -d vamp:nnls-chroma:chordino:simplechords -w csv --csv-stdout %AUDIO%
%SONIC% --plugin-path %VAMPPATH% -d vamp:mtg-melodia:melodia:melody -w csv --csv-stdout %AUDIO%
