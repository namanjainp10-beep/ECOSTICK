# ECOSTICK Dashboard

Frontend for ECOSTICK, a portable environmental monitor: air quality (AQI), temperature, humidity, rain likelihood and soil condition.

## Run
Open `index.html` in a browser, or serve the folder: `python -m http.server 8000`.
It starts in **demo mode** with simulated readings.

## Connect the real device
In `app.js`, set `CONFIG.DEVICE_URL` to your device endpoint (e.g. `http://192.168.1.50/data`). It must return JSON:

```json
{"pm25":42,"pm10":88,"temp":31.2,"humidity":48,"pressure":1006.4,
 "soilMoisture":35,"soilPh":6.8,"soilTemp":27.5}
```
The device must send CORS headers (`Access-Control-Allow-Origin: *`).

## Notes
- AQI uses India CPCB breakpoints from PM2.5 and PM10.
- Rain likelihood is a simple indicator from humidity, dew-point gap and pressure drop, not a forecast.
- Readings are indicative and do not replace certified monitoring stations.

## Push to GitHub
```
git init && git add . && git commit -m "ECOSTICK dashboard"
git branch -M main
git remote add origin <your-repo-url>
git push -u origin main
```
### Project Files (CAD)
* [https://drive.google.com/drive/folders/1BAvE_N6MwyAIFVa_VgnP7E-A-aaA5A-d?usp=sharing]
