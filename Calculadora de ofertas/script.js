function limpiar(){
    document.getElementById("r_oferta").innerHTML = "El precio final es:";
}
function limpiar2(){
    document.getElementById("r_subida").innerHTML = "El precio final es:";
}

function oferta(){
    var precio = document.getElementById("p_oferta").value;
    var descuento = 1-document.getElementById("descuento").value/100;
    var resultado= precio*descuento;

    document.getElementById("r_oferta").innerHTML= document.getElementById("r_oferta").innerHTML + " " + resultado;
}

function subida(){
    var precio = document.getElementById("p_subida").value;
    var porcentaje = 1+document.getElementById("subida").value/100;
    var resultado= precio*porcentaje;

    document.getElementById("r_subida").innerHTML= document.getElementById("r_subida").innerHTML + " " + resultado;
}