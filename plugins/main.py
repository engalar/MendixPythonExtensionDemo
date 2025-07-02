import json
from typing import Any, Dict, List
from abc import ABC, abstractmethod

import clr
clr.AddReference("Mendix.StudioPro.ExtensionsAPI")
from Mendix.StudioPro.ExtensionsAPI.Model.UntypedModel import PropertyType
from Mendix.StudioPro.ExtensionsAPI.Model.Microflows import IMicroflow
from Mendix.StudioPro.ExtensionsAPI.Model.Pages import IPage

# ShowDevTools() # Kept for consistency, commented out

# Original utility functions remain unchanged as they are part of the required API
def serialize_json_object(json_object: Any) -> str:
    import System.Text.Json
    return System.Text.Json.JsonSerializer.Serialize(json_object)

def deserialize_json_string(json_string: str) -> Any:
    return json.loads(json_string)

def post_message(channel: str, message: str):
    PostMessage(channel, message)

# --- I. ABSTRACTIONS (Interfaces) ---
# We define the contracts that our high-level components will depend on.

class IElementRetriever(ABC):
    """
    Abstract interface for retrieving elements from the Mendix model.
    """
    @abstractmethod
    def get_all_elements(self) -> List[Dict[str, Any]]:
        pass

    @abstractmethod
    def get_domain_model_elements(self) -> List[Dict[str, Any]]:
        pass

    @abstractmethod
    def get_microflows(self) -> List[Dict[str, Any]]:
        pass

    @abstractmethod
    def get_pages(self) -> List[Dict[str, Any]]:
        pass
    
    @abstractmethod
    def get_element_details(self, element_id: str, element_type: str) -> Dict[str, Any]:
        pass

class IEditorActions(ABC):
    """
    Abstract interface for performing actions within the Studio Pro editor.
    """
    @abstractmethod
    def locate_element(self, qualified_name: str, element_type: str) -> Dict[str, Any]:
        pass

# --- II. LOW-LEVEL MODULES (Concrete Implementations) ---
# These classes implement the abstractions and contain the specific, low-level logic.

class MendixElementRetriever(IElementRetriever):
    """
    Concrete implementation for retrieving elements using the Mendix Extensions API.
    """
    def __init__(self, root):
        self._root = root

    def get_all_elements(self) -> List[Dict[str, Any]]:
        return self._get_elements("Projects$Module")
    
    def get_domain_model_elements(self) -> List[Dict[str, Any]]:
        elements = []
        modules = self._get_modules()
        for module in modules:
            module_name = module.Name
            domain_models = module.GetUnitsOfType("DomainModels$DomainModel")
            for dm in domain_models:
                elements.append({
                    "id": str(dm.ID),
                    "name": f"{module_name}.{dm.Name}",
                    "type": "DomainModel"
                })
                entities = dm.GetElementsOfType("DomainModels$Entity")
                for entity in entities:
                    elements.append({
                        "id": str(entity.ID),
                        "name": f"{module_name}.{entity.Name}",
                        "type": "Entity"
                    })
        return elements

    def get_microflows(self) -> List[Dict[str, Any]]:
        return self._get_elements("Microflows$Microflow")

    def get_pages(self) -> List[Dict[str, Any]]:
        return self._get_elements("Pages$Page")

    def get_element_details(self, element_id: str, element_type: str) -> Dict[str, Any]:
        element = self._get_element_by_id_and_type(element_id, element_type)
        if element:
            return self._extract_element_details(element)
        else:
            raise Exception(f"Element with ID {element_id} and type {element_type} not found")

    # --- Helper methods (private implementation details) ---
    
    def _get_modules(self):
        return self._root.GetUnitsOfType("Projects$Module")

    def _get_elements(self, unit_type: str) -> List[Dict[str, Any]]:
        elements = []
        modules = self._get_modules()
        if unit_type == "Projects$Module":
            for module in modules:
                elements.append({
                    "id": str(module.ID),
                    "name": f"{module.Name}",
                    "type": unit_type.split("$")[-1]
                })
            return elements
        for module in modules:
            module_name = module.Name
            units = module.GetUnitsOfType(unit_type)
            for unit in units:
                elements.append({
                    "id": str(unit.ID),
                    "name": f"{module_name}.{unit.Name}",
                    "type": unit_type.split("$")[-1],
                    "qualifiedName": unit.QualifiedName if hasattr(unit, "QualifiedName") else None
                })
        return elements

    def _get_element_by_id_and_type(self, element_id: str, element_type: str) -> Any:
        unit_type_map = {
            "Module": "Projects$Module",
            "DomainModel": "DomainModels$DomainModel",
            "Microflow": "Microflows$Microflow",
            "Page": "Pages$Page",
            "Entity": "DomainModels$Entity"
        }
        unit_type = unit_type_map.get(element_type)
        if not unit_type:
            return None

        if element_type == "Entity":
            modules = self._get_modules()
            for module in modules:
                domain_models = module.GetUnitsOfType("DomainModels$DomainModel")
                for dm in domain_models:
                    entities = dm.GetElementsOfType("DomainModels$Entity")
                    for entity in entities:
                        if str(entity.ID) == element_id:
                            return entity
            return None
            
        units = self._root.GetUnitsOfType(unit_type)
        for unit in units:
            if str(unit.ID) == element_id:
                return unit
        return None

    def _extract_element_details(self, element) -> Dict[str, Any]:
        details = {
            "name": element.Name,
            "type": element.Type,
            "properties": [],
            "children": [],
            "qualifiedName": element.QualifiedName
        }
        for prop in element.GetProperties():
            prop_details = {
                "name": prop.Name,
                "type": str(prop.Type),
                "value": str(prop.Value) if prop.Value is not None else "N/A"
            }
            if prop.Type == PropertyType.Element:
                if prop.IsList:
                    prop_details["value"] = f"[{len(list(prop.Value))} elements]" if prop.Value else "[]"
                else:
                    prop_details["value"] = str(prop.Value.Name) if prop.Value else "N/A"
            details["properties"].append(prop_details)
        for child in element.GetElements():
            details["children"].append({
                "name": child.Name if hasattr(child, "Name") else "Unnamed",
                "type": child.Type
            })
        return details

class MendixEditorActions(IEditorActions):
    """
    Concrete implementation for editor actions using global Mendix API functions.
    """
    def locate_element(self, qualifiedName: str, elementType: str) -> Dict[str, Any]:
        print(f"Open element called for {qualifiedName} of type {elementType}")
        
        unit_type_map = {
            "Microflows$Microflow": IMicroflow,
            "Pages$Page": IPage
        }
        
        element_type_api = unit_type_map.get(elementType)
                
        if element_type_api is None:
            raise Exception(f"Unsupported element type: {elementType}")

        method = currentApp.ToQualifiedName[element_type_api]
        element_qname = method(qualifiedName)
        element = element_qname.Resolve()

        if element is None:
             raise Exception(f"element is not found")
        TryOpenEditor(element)
        return {"success": True, "message": f"Open element called for {qualifiedName}"}


# --- III. HIGH-LEVEL MODULE ---
# This class now depends on the abstractions, not the concrete implementations.

class RpcHandler:
    def __init__(self, element_retriever: IElementRetriever, editor_actions: IEditorActions):
        self.element_retriever = element_retriever
        self.editor_actions = editor_actions
        self.methods = {
            'getAllElements': self.get_all_elements,
            'getDomainModels': self.get_domain_models,
            'getMicroflows': self.get_microflows,
            'getPages': self.get_pages,
            'getElementDetails': self.get_element_details,
            'locateElement': self.locate_element
        }
    
    def handle_request(self, request: Dict[str, Any]) -> Dict[str, Any]:
        method = request.get('method')
        params = request.get('params', {})
        request_id = request.get('id')
        
        if method not in self.methods:
            return {
                'jsonrpc': '2.0',
                'error': f'Method "{method}" not found',
                'id': request_id
            }
        
        try:
            result = self.methods[method](**params)
            return {
                'jsonrpc': '2.0',
                'result': result,
                'requestId': request_id
            }
        except Exception as e:
            return {
                'jsonrpc': '2.0',
                'error': str(e),
                'requestId': request_id
            }
    
    # These methods now simply delegate to the injected dependency.
    def get_all_elements(self):
        return self.element_retriever.get_all_elements()
    
    def get_domain_models(self):
        return self.element_retriever.get_domain_model_elements()
    
    def get_microflows(self):
        return self.element_retriever.get_microflows()
    
    def get_pages(self):
        return self.element_retriever.get_pages()
    
    def get_element_details(self, elementId, elementType):
        return self.element_retriever.get_element_details(elementId, elementType)

    def locate_element(self, qualifiedName, elementType):
        return self.editor_actions.locate_element(qualifiedName, elementType)


# --- IV. COMPOSITION ROOT & EVENT HANDLING ---
# This is where we create our concrete objects and "wire" them together.

# 1. Instantiate the concrete low-level modules
mendix_element_retriever = MendixElementRetriever(root)
mendix_editor_actions = MendixEditorActions()

# 2. Inject the dependencies into the high-level module
rpc_handler = RpcHandler(
    element_retriever=mendix_element_retriever, 
    editor_actions=mendix_editor_actions
)

# The onMessage event handler remains the entry point.
def onMessage(e):
    message_data = deserialize_json_string(serialize_json_object(e))
    if e.Message == "frontend:message":
        data = message_data["Data"]
        # The rpc_handler instance is now used here
        response = rpc_handler.handle_request(data)
        post_message("backend:response", json.dumps(response))