import React, { useCallback, useRef, useState } from "react";
import {
  GoogleMap,
  useLoadScript,
  Marker,
  InfoWindow,
} from "@react-google-maps/api";
import { formatRelative } from "date-fns";
import usePlacesAutocomplete, {
  getGeocode,
  getLatLng,
} from "use-places-autocomplete";
import {
  Combobox,
  ComboboxInput,
  ComboboxPopover,
  ComboboxList,
  ComboboxOption,
} from "@reach/combobox";

import "./App.css";
import "@reach/combobox/styles.css";
import mapStyles from "./mapStyles";
import { useQuery } from "react-query";

const libraries = ["places"];
const mapContainerStyle = {
  width: "100vw",
  height: "100vh",
};
const center = {
  lat: 30.332184,
  lng: -81.655647,
};
const options = {
  styles: mapStyles,
  disableDefaultUI: true,
  zoomControl: true,
};

export default function App() {
  const { isLoaded, loadError } = useLoadScript({
    googleMapsApiKey: process.env.REACT_APP_GOOGLE_MAPS_API_KEY,
    libraries,
  });
  const [markers, setMarkers] = useState([]);
  const [selected, setSelected] = useState(null);

  // using callBack hook to avoid triggering a map re-rendering
  const onMapClick = useCallback((e) => {
    setMarkers((current) => [
      ...current,
      {
        lat: e.latLng.lat(),
        lng: e.latLng.lng(),
        time: new Date(),
      },
    ]);
  }, []);

  // adding a map reference when map loading abd using callBack hook
  // doesn't cause re-rendering
  const mapRef = useRef();
  const onMapLoad = useCallback((map) => {
    mapRef.current = map;
  }, []);

  const panToMap = useCallback(({ lat, lng }) => {
    mapRef.current.panTo({ lat, lng });
    mapRef.current.setZoom(12);
  }, []);

  if (loadError) return "Error loading maps";
  if (!isLoaded) return "Loading maps ...";

  return (
    <div>
      <h1>
        Shark Activity{" "}
        <span role="img" aria-label="shark">
          {" "}
          🦈{" "}
        </span>
      </h1>
      <Search panToMap={panToMap} />
      <Locate panToMap={panToMap} setMarkers={setMarkers} />
      <GoogleMap
        mapContainerStyle={mapContainerStyle}
        zoom={8}
        center={center}
        options={options}
        onClick={onMapClick}
        onLoad={onMapLoad}
      >
        {markers.map((marker) => (
          <Marker
            key={marker.time}
            position={{ lat: marker.lat, lng: marker.lng }}
            icon={{
              url: "/shark.svg",
              scaledSize: new window.google.maps.Size(40, 40),
              origin: new window.google.maps.Point(0, 0),
              anchor: new window.google.maps.Point(20, 20),
            }}
            onClick={() => {
              setSelected(marker);
            }}
          />
        ))}

        {selected ? (
          <InfoWindow
            position={{ lat: selected.lat, lng: selected.lng }}
            onCloseClick={() => {
              setSelected(null);
            }}
          >
            <div>
              <h2>Shark Activity!</h2>
              {/*<p>Activity {formatRelative(selected.time, new Date())}</p>*/}
            </div>
          </InfoWindow>
        ) : null}
      </GoogleMap>
    </div>
  );
}

async function fetchSharkActivities() {
  const response = fetch(
    `https://shark-activity-react-firebase.firebaseio.com/sharkActivities.json`
  );
  return (await response).json();
}

function Locate({ panToMap, setMarkers }) {
  const { status, data, error } = useQuery("activities", fetchSharkActivities);
  return (
    // <button
    //   className="locate"
    //   onClick={() => {
    //     navigator.geolocation.getCurrentPosition(
    //       (position) => {
    //         panToMap({
    //           lat: position.coords.latitude,
    //           lng: position.coords.longitude,
    //         });
    //       },
    //       (error) => null
    //     );
    //   }}
    // >
    //   <img src="compass.svg" alt="compass - locate me" />
    // </button>
    <button
      className="locate"
      onClick={() => {
        console.log("error:", error);
        console.log("status:", status);
        console.log("data:", data);
        // -MILLtiGL1UHUbnPlObU
        console.log(
          "data with key -MILZAOQCcDnJdEoE8Hh",
          data["-MILZAOQCcDnJdEoE8Hh"]
        );
        setMarkers((current) => [
          ...current,
          {
            lat: data["-MILZAOQCcDnJdEoE8Hh"].lat,
            lng: data["-MILZAOQCcDnJdEoE8Hh"].lng,
            time: data["-MILZAOQCcDnJdEoE8Hh"].time,
          },
        ]);
      }}
    >
      <img src="compass.svg" alt="compass - locate me" />
    </button>
  );
}

function Search({ panToMap }) {
  const {
    ready,
    value,
    suggestions: { status, data },
    setValue,
    clearSuggestions,
  } = usePlacesAutocomplete({
    requestOptions: {
      location: { lat: () => 30.332184, lng: () => -81.655647 },
      radius: 100 * 1000,
    },
  });

  return (
    <div className="search">
      <Combobox
        onSelect={async (address) => {
          setValue(address, false);
          clearSuggestions();

          try {
            const results = await getGeocode({ address });
            const { lat, lng } = await getLatLng(results[0]);
            panToMap({ lat, lng });
          } catch (e) {
            console.log("error !!");
          }
        }}
      >
        <ComboboxInput
          value={value}
          onChange={(e) => {
            setValue(e.target.value);
          }}
          disabled={!ready}
          placeholder="Enter an address"
        />
        <ComboboxPopover>
          <ComboboxList>
            {status === "OK" &&
              data.map(({ id, description }) => (
                <ComboboxOption key={id} value={description} />
              ))}
          </ComboboxList>
        </ComboboxPopover>
      </Combobox>
    </div>
  );
}
