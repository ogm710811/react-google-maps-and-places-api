import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  GoogleMap,
  InfoWindow,
  Marker,
  useLoadScript,
} from "@react-google-maps/api";
import { formatRelative } from "date-fns";
import usePlacesAutocomplete, {
  getGeocode,
  getLatLng,
} from "use-places-autocomplete";
import {
  Combobox,
  ComboboxInput,
  ComboboxList,
  ComboboxOption,
  ComboboxPopover,
} from "@reach/combobox";

import "./App.css";
import "@reach/combobox/styles.css";
import mapStyles from "./mapStyles";
import { queryCache, useMutation, useQuery } from "react-query";

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

async function fetchSharkActivities() {
  const response = fetch(
    `https://shark-activity-react-firebase.firebaseio.com/sharkActivities.json`
  );
  return (await response).json();
}

async function createSharkActivity(newActivity) {
  const response = await fetch(
    `https://shark-activity-react-firebase.firebaseio.com/sharkActivities.json`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newActivity),
    }
  );
  return (await response).json();
}

export default function App() {
  const { isLoaded, loadError } = useLoadScript({
    googleMapsApiKey: process.env.REACT_APP_GOOGLE_MAPS_API_KEY,
    libraries,
  });

  const [markers, setMarkers] = useState([]);
  const [selected, setSelected] = useState(null);

  const { status, data, error } = useQuery("activities", fetchSharkActivities);
  useEffect(() => {
    const sharkActivities = [];
    if (status === "success") {
      for (let key in data) {
        if (data.hasOwnProperty(key)) {
          sharkActivities.push({
            ...data[key],
            id: key,
          });
        }
      }
    }
    console.log("sharkActivities on callBack : ", sharkActivities);
    setMarkers((current) => [...current, ...sharkActivities]);
  }, [data]);

  /***
   * useMutation with Refetching Data example:
   */
  // some downsides are:
  // the fetching is slow since the onSuccess has to wait for the mutation to finish
  // but also has to refetshing the data from service [open network tab on devtools and
  // see 2 calls
  /***
   const [mutate] = useMutation(createSharkActivity, {
      onSuccess: () => {
        queryCache.refetchQueries("activities");
      },
    });
   /***
   * end example:
   */

  /***
   * useMutation with Response Cache Update example:
   */
  // onSuccess function receives the data we are posting to server in createSharkActivity
  // with setQueryData we can manipulate the data in the cache
  // giving the proper key "activities" we can access the cache (prevActivities) and update it
  // with the new value of activity

  const [mutate] = useMutation(createSharkActivity, {
    onSuccess: (newActivity) => {
      queryCache.setQueryData("activities", (prevActivitiesData) => [
        ...prevActivitiesData,
        newActivity,
      ]);
    },
  });
  /***
   * end example:
   */

  /***
   * useMutation with Optimistic Cache Update example:
   */
  // Optimistic Cache update has 3 lifecycles:
  // onMutate: receives the new data that will send to server
  // onError: gives the error, the new Data and a rollback function that when error you can rollback the optimistic UI update
  // onSettled: after everything goes OK we update the data from the cache

  // Will need to be review it since it throws an error on line 136
  // " object is not iterable (cannot read property Symbol(Symbol.iterator))"
  /***
   const [mutate] = useMutation(createSharkActivity, {
      onMutate: (newActivity) => {
        queryCache.cancelQueries("activities");
        const snapshot = queryCache.getQueryData("activities");
        queryCache.setQueryData("activities", (prevActivitiesData) => [
          ...prevActivitiesData,
          newActivity,
        ]);
  
        return () => queryCache.setQueryData("activities", snapshot);
      },
      onError: (error, newActivity, rollback) =>
        queryCache.setQueryData("activities", rollback),
      onSettled: () => queryCache.refetchQueries("activities"),
    });
   /***
   * end example:
   */

  // using callBack hook to avoid triggering a map re-rendering
  const onMapClick = useCallback((e) => {
    const newActivity = {
      lat: e.latLng.lat(),
      lng: e.latLng.lng(),
      time: new Date(),
      postBy: "user name",
    };
    setMarkers((prev) => [...prev, newActivity]);
    mutate(newActivity);
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

  if (error) return "Error loading data";
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
            key={Math.random() * 100}
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
              <p>Activity {formatRelative(new Date(selected.time), new Date())}</p>
              <p>Posted By: {selected.postBy}</p>
            </div>
          </InfoWindow>
        ) : null}
      </GoogleMap>
    </div>
  );
}

function Locate({ panToMap }) {
  return (
    <button
      className="locate"
      onClick={() => {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            panToMap({
              lat: position.coords.latitude,
              lng: position.coords.longitude,
            });
          },
          (error) => console.log(error)
        );
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
